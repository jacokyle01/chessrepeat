package ws

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"sync"
	"time"

	"chessrepeat/internal/auth"
	"chessrepeat/internal/domain"
	"chessrepeat/internal/store"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

// Server maintains per-owner "rooms" of subscribers and fans out
// messages within each room.
type Server struct {
	// subscriberMessageBuffer controls the max number of messages that
	// can be queued for a subscriber before it is kicked. Defaults to 16.
	subscriberMessageBuffer int

	db *store.DB

	logf func(f string, v ...any)

	// mu protects both the rooms map and each room's subscriber set.
	mu    sync.Mutex
	rooms map[string]*room
}

// room is a set of subscribers listening to events for one owner's repertoire.
type room struct {
	id          string
	subscribers map[*subscriber]struct{}
}

// subscriber represents a connected user. userID is pinned from the
// session cookie at handshake time, so every message the connection
// produces is attributable to a user. room is the owner room this
// subscriber belongs to for its entire lifetime.
type subscriber struct {
	msgs     chan []byte
	userID   string
	username string
	picture  string
	room     *room
}

func (s *subscriber) peerInfo() domain.PeerInfo {
	return domain.PeerInfo{UserID: s.userID, Username: s.username, Picture: s.picture}
}

// NewServer constructs a Server with the defaults.
func NewServer(db *store.DB) *Server {
	return &Server{
		subscriberMessageBuffer: 16,
		db:                      db,
		logf:                    log.Printf,
		rooms:                   make(map[string]*room),
	}
}

// SubscribeHandler is the HTTP entry point for the WebSocket. Rooms are
// keyed by owner TokenID since that's what chapter documents reference,
// so the username is resolved before upgrade.
func (s *Server) SubscribeHandler(w http.ResponseWriter, r *http.Request) {
	username := r.PathValue("username")
	if username == "" {
		http.Error(w, "missing username", http.StatusBadRequest)
		return
	}

	owner, err := s.db.FetchUserByUsername(username)
	if err != nil {
		http.Error(w, "user lookup failed", http.StatusInternalServerError)
		return
	}
	if owner == nil {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	err = s.subscribe(w, r, owner.TokenID)
	if errors.Is(err, context.Canceled) {
		return
	}
	if websocket.CloseStatus(err) == websocket.StatusNormalClosure ||
		websocket.CloseStatus(err) == websocket.StatusGoingAway {
		return
	}
	if err != nil {
		s.logf("%v", err)
		return
	}
}

// subscribe authenticates the connection, joins the owner room, and
// services the read/write loops until the context is cancelled.
func (s *Server) subscribe(w http.ResponseWriter, r *http.Request, ownerID string) error {
	cookie, err := r.Cookie(auth.SessionCookieName)
	if err != nil {
		http.Error(w, "missing session", http.StatusUnauthorized)
		return err
	}
	sess, err := s.db.FetchSession(cookie.Value)
	if err != nil {
		http.Error(w, "session lookup failed", http.StatusInternalServerError)
		return err
	}
	if sess == nil {
		http.Error(w, "invalid or expired session", http.StatusUnauthorized)
		return errors.New("invalid or expired session")
	}

	user, err := s.db.FetchUser(sess.UserID)
	if err != nil {
		http.Error(w, "user lookup failed", http.StatusInternalServerError)
		return err
	}
	if user == nil {
		http.Error(w, "user not found", http.StatusUnauthorized)
		return errors.New("user not found")
	}

	sub := &subscriber{
		msgs:     make(chan []byte, s.subscriberMessageBuffer),
		userID:   sess.UserID,
		username: user.Username,
		picture:  user.Picture,
	}
	s.join(ownerID, sub)
	defer s.leave(sub)

	c, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"localhost:5173"},
	})
	if err != nil {
		return err
	}
	defer c.CloseNow()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	// reader goroutine: pulls messages off the socket and dispatches
	// them. when the client disconnects (or sends garbage), cancel()
	// trips the writer loop below so we tear the connection down
	// cleanly.
	go func() {
		defer cancel()
		for {
			_, data, err := c.Read(ctx)
			if err != nil {
				return
			}
			s.handleMessage(sub, data)
		}
	}()

	// writer loop: forwards broadcast messages to this subscriber.
	for {
		select {
		case msg := <-sub.msgs:
			if err := writeTimeout(ctx, time.Second*5, c, msg); err != nil {
				return err
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// join adds the subscriber to the named owner room, creating the room
// on first use. Pins s.room so publishRoom can find the peers later
// without another lookup. Sends a "crowd" snapshot to the joiner and
// broadcasts "user_joined" to existing members.
func (s *Server) join(ownerID string, sub *subscriber) {
	s.mu.Lock()
	defer s.mu.Unlock()

	r, ok := s.rooms[ownerID]
	if !ok {
		r = &room{
			id:          ownerID,
			subscribers: make(map[*subscriber]struct{}),
		}
		s.rooms[ownerID] = r
		s.logf("created room for owner %s", ownerID)
	}

	peers := make([]domain.PeerInfo, 0, len(r.subscribers))
	for peer := range r.subscribers {
		peers = append(peers, peer.peerInfo())
	}

	r.subscribers[sub] = struct{}{}
	sub.room = r

	crowd, _ := json.Marshal(struct {
		Type  string            `json:"type"`
		Users []domain.PeerInfo `json:"users"`
	}{Type: "crowd", Users: append(peers, sub.peerInfo())})
	select {
	case sub.msgs <- crowd:
	default:
	}

	joined, _ := json.Marshal(struct {
		Type string          `json:"type"`
		User domain.PeerInfo `json:"user"`
	}{Type: "user_joined", User: sub.peerInfo()})
	for peer := range r.subscribers {
		if peer == sub {
			continue
		}
		select {
		case peer.msgs <- joined:
		default:
		}
	}
}

// leave removes the subscriber from its room, broadcasts "user_left" to
// remaining members, and deletes the room if it becomes empty.
func (s *Server) leave(sub *subscriber) {
	s.mu.Lock()
	defer s.mu.Unlock()

	r := sub.room
	if r == nil {
		return
	}
	delete(r.subscribers, sub)
	if len(r.subscribers) == 0 {
		delete(s.rooms, r.id)
		s.logf("destroyed empty room %s", r.id)
		return
	}

	left, _ := json.Marshal(struct {
		Type string          `json:"type"`
		User domain.PeerInfo `json:"user"`
	}{Type: "user_left", User: sub.peerInfo()})
	for peer := range r.subscribers {
		select {
		case peer.msgs <- left:
		default:
		}
	}
}

// publishRoom fans a message out to every subscriber in the given room
// except the sender. Non-blocking: slow subscribers get evicted.
// Pass sender == nil to broadcast to every member of the room.
func (s *Server) publishRoom(r *room, msg []byte, sender *subscriber) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for sub := range r.subscribers {
		if sub == sender {
			continue
		}
		select {
		case sub.msgs <- msg:
		default:
			// Drop the slow subscriber. Can't call leave here (holds
			// the same mutex); schedule it on a goroutine instead.
			go s.leave(sub)
		}
	}
}

func writeTimeout(ctx context.Context, timeout time.Duration, c *websocket.Conn, msg []byte) error {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	return wsjson.Write(ctx, c, json.RawMessage(msg))
}
