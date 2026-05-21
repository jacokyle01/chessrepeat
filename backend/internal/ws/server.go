package ws

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"chessrepeat/internal/auth"
	"chessrepeat/internal/domain"
	"chessrepeat/internal/ratelimit"
	"chessrepeat/internal/store"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

// readLimitBytes caps the size of a single inbound WebSocket message.
// Our largest legit payload is a chapter_created event carrying a PGN —
// tens of KB at most. 64 KiB is enough headroom that no real client hits
// it, while preventing an authenticated peer from streaming multi-MB
// JSON to burn DB/CPU.
const readLimitBytes int64 = 64 * 1024

// per-subscriber message budget: sustained 10 msg/sec, burst 30. A
// collaborator entering moves rapidly will fit; a malicious client
// blasting events gets pinned to the refill rate and silently dropped.
const (
	wsBucketCapacity = 30
	wsRefillPerSec   = 10
)

// dbOpTimeout caps how long a single ws-driven DB operation may run.
// The query is cancelled past this even if the client stays connected,
// so a slow query can't hold a pool connection hostage.
const dbOpTimeout = 10 * time.Second

// Liveness: the client pings every clientPingInterval (~20s) and the
// server replies with pong (dispatch.go). The server-side watcher
// closes any connection that hasn't produced inbound traffic in
// idleTimeout — long enough to ride out a couple of skipped pings on a
// flaky link, short enough to reclaim slots from genuinely-dead peers.
// livenessCheckInterval is how often the watcher inspects lastSeenAt.
const (
	idleTimeout           = 30 * time.Second
	livenessCheckInterval = 10 * time.Second
)

// Server maintains per-owner "rooms" of subscribers and fans out
// messages within each room.
type Server struct {
	// subscriberMessageBuffer controls the max number of messages that
	// can be queued for a subscriber before it is kicked. Defaults to 16.
	subscriberMessageBuffer int

	db *store.DB

	// allowedOrigins is the whitelist of Origin headers permitted on the
	// WebSocket upgrade. Origins are stored as raw `host:port` patterns
	// matching coder/websocket's OriginPatterns.
	allowedOrigins []string

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
	// permission is pinned at handshake from EffectivePermissionOnRepertoire
	// against the joined room's owner. Used for the PeerInfo color cue and
	// (for chapter_created, where there's no chapter yet to anchor on) as
	// the authz source for that one op. Every other mutating op re-checks
	// against the chapter's actual owner_id, so a stale snapshot here can't
	// grant write access to a foreign repertoire.
	permission string
	room       *room
	// readBudget gates inbound messages so a malicious client can't
	// burn CPU/DB by flooding the connection. Allocated per-connection
	// so one chatty peer can't starve another.
	readBudget *ratelimit.Bucket
	// lastSeenAt is the unix-nano timestamp of the most recent inbound
	// message (any type — pings, mutations, anything). The liveness
	// watcher kicks the subscriber if this falls outside idleTimeout.
	// atomic because reader (writes) and watcher (reads) run concurrently.
	lastSeenAt atomic.Int64
}

func (s *subscriber) peerInfo() domain.PeerInfo {
	return domain.PeerInfo{Username: s.username, Picture: s.picture, Permission: s.permission}
}

// NewServer constructs a Server with the defaults. originPatterns is the
// list of Origin host[:port] patterns accepted on the WebSocket upgrade
// (see coder/websocket AcceptOptions.OriginPatterns).
func NewServer(db *store.DB, originPatterns []string) *Server {
	return &Server{
		subscriberMessageBuffer: 16,
		db:                      db,
		allowedOrigins:          originPatterns,
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

	owner, err := s.db.FetchUserByUsername(r.Context(), username)
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
	sess, err := s.db.FetchSession(r.Context(), cookie.Value)
	if err != nil {
		http.Error(w, "session lookup failed", http.StatusInternalServerError)
		return err
	}
	if sess == nil {
		http.Error(w, "invalid or expired session", http.StatusUnauthorized)
		return errors.New("invalid or expired session")
	}

	user, err := s.db.FetchUser(r.Context(), sess.UserID)
	if err != nil {
		http.Error(w, "user lookup failed", http.StatusInternalServerError)
		return err
	}
	if user == nil {
		http.Error(w, "user not found", http.StatusUnauthorized)
		return errors.New("user not found")
	}

	//TODO check permission at websocket message time, trigger reload if 
	perm, err := s.db.EffectivePermissionOnRepertoire(r.Context(), ownerID, sess.UserID)
	if err != nil {
		http.Error(w, "view auth check failed", http.StatusInternalServerError)
		return err
	}
	if perm == "" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return errors.New("not a collaborator")
	}

	sub := &subscriber{
		msgs:       make(chan []byte, s.subscriberMessageBuffer),
		userID:     sess.UserID,
		username:   user.Username,
		picture:    user.Picture,
		permission: perm,
		readBudget: ratelimit.NewBucket(wsBucketCapacity, wsRefillPerSec),
	}
	sub.lastSeenAt.Store(time.Now().UnixNano())
	s.join(ownerID, sub)
	defer s.leave(sub)

	c, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: s.allowedOrigins,
	})
	if err != nil {
		return err
	}
	defer c.CloseNow()
	c.SetReadLimit(readLimitBytes)

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	// liveness watcher: kicks the subscriber if no inbound message has
	// arrived in idleTimeout. Pairs with the client-side ping interval:
	// a healthy peer pings every ~20s, so a 60s gap means the link is
	// dead even if TCP hasn't noticed yet.
	go func() {
		ticker := time.NewTicker(livenessCheckInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				last := time.Unix(0, sub.lastSeenAt.Load())
				if time.Since(last) > idleTimeout {
					s.logf("ws idle timeout (%s): kicking user %s", time.Since(last).Round(time.Second), sub.userID)
					cancel()
					return
				}
			}
		}
	}()

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
			// Any inbound traffic (even rate-limited / unknown ops) keeps
			// the subscriber alive — it proves the socket is bidirectional.
			sub.lastSeenAt.Store(time.Now().UnixNano())
			if !sub.readBudget.Allow() {
				// Pinned to the refill rate — drop silently rather than
				// closing the socket, since legit clients may briefly
				// burst above capacity (e.g. paste of a long line).
				s.logf("ws rate limit: dropping message from user %s", sub.userID)
				continue
			}
			// Per-message DB budget. Bounded so a slow query can't pin
			// a connection past the message lifetime; derived from ctx
			// so connection close still cancels in-flight work early.
			msgCtx, msgCancel := context.WithTimeout(ctx, dbOpTimeout)
			s.handleMessage(msgCtx, sub, data)
			msgCancel()
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

// sendTo delivers a message to a single subscriber. Non-blocking and
// same eviction policy as publishRoom: a subscriber too slow to drain
// its buffer is dropped rather than stalling the caller.
func (s *Server) sendTo(sub *subscriber, msg []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()

	select {
	case sub.msgs <- msg:
	default:
		go s.leave(sub)
	}
}

// NotifyRepertoireChanged tells every client currently in the given
// owner's room to re-fetch the repertoire over HTTP. Used by the
// chapter HTTP POST path: a full chapter tree is too large for the WS
// frame cap, so it's persisted over HTTP and connected peers are nudged
// to resync rather than receiving the tree over the socket. No-op if no
// room exists for the owner.
func (s *Server) NotifyRepertoireChanged(ownerID string) {
	s.mu.Lock()
	r, ok := s.rooms[ownerID]
	s.mu.Unlock()
	if !ok {
		return
	}
	// sender == nil: broadcast to everyone, including the creator's
	// other sessions. The creator's active tab already has the chapter
	// locally; a redundant resync just reconciles it with the
	// authoritative (possibly cap-trimmed) server state.
	s.publishRoom(r, reloadMessage, nil)
}

func writeTimeout(ctx context.Context, timeout time.Duration, c *websocket.Conn, msg []byte) error {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	return wsjson.Write(ctx, c, json.RawMessage(msg))
}
