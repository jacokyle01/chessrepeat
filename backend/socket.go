package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

// same as frontend
type TrainingData struct {
	ID       string    `json:"id"` // this is NOT really an ID in the sense that it's being used. TODO
	FEN      string    `json:"fen"`
	Ply      int       `json:"ply"`
	SAN      string    `json:"san"`
	Comment  string    `json:"comment"`
	Enabled  bool      `json:"enabled"`
	Training *CardData `json:"training"` // null if unseen
}

// same as frontend from ts fsrs lib
type CardData struct {
	Due           string  `json:"due"`
	Stability     float64 `json:"stability"`
	Difficulty    float64 `json:"difficulty"`
	ElapsedDays   int     `json:"elapsed_days"`
	ScheduledDays int     `json:"scheduled_days"`
	Reps          int     `json:"reps"`
	Lapses        int     `json:"lapses"`
	State         int     `json:"state"`
	LastReview    string  `json:"last_review"`
}

// MoveEvent is the WebSocket message envelope for move creation events.
type MoveEvent struct {
	Type      string       `json:"type"`      // "move_created"
	ChapterID string       `json:"chapterId"` // websocket connections will be per-repertoire, need to know which chapter
	Move      TrainingData `json:"move"`
	Path      string       `json:"path"`
}

// NodeDeleteEvent is the WebSocket message envelope for node deletion events.
type NodeDeleteEvent struct {
	Type      string `json:"type"`      // "node_deleted"
	ChapterID string `json:"chapterId"`
	Path      string `json:"path"`
}

// ChapterEvent is the WebSocket message envelope for chapter creation events.
type ChapterEvent struct {
	Type         string           `json:"type"`         // "chapter_created"
	ChapterID    string           `json:"chapterId"`		// TODO uuid? 
	RepertoireID string           `json:"repertoireId"`
	Name         string           `json:"name"`
	TrainAs      string           `json:"trainAs"`
	Root         ChapterTreeNode  `json:"root"`
}

// chatServer maintains per-repertoire "rooms" of subscribers and fans out
// messages within each room.
type chatServer struct {
	// subscriberMessageBuffer controls the max number
	// of messages that can be queued for a subscriber
	// before it is kicked.
	//
	// Defaults to 16.
	subscriberMessageBuffer int

	// db is the database connection for persisting moves.
	db *DB

	// logf controls where logs are sent.
	// Defaults to log.Printf.
	logf func(f string, v ...any)

	// mu protects both the rooms map and each room's subscriber set.
	mu    sync.Mutex
	rooms map[string]*room
}

// room is a set of subscribers listening to events for one repertoire.
type room struct {
	id          string
	subscribers map[*subscriber]struct{}
}

// newChatServer constructs a chatServer with the defaults.
func newChatServer(db *DB) *chatServer {
	return &chatServer{
		subscriberMessageBuffer: 16,
		db:                      db,
		logf:                    log.Printf,
		rooms:                   make(map[string]*room),
	}
}

// subscriber represents a subscriber. userID is pinned from the session
// cookie at handshake time, so every message the connection produces is
// attributable to a user. room is the repertoire room this subscriber
// belongs to for its entire lifetime.
type subscriber struct {
	msgs   chan []byte
	userID string
	room   *room
}

func (cs *chatServer) subscribeHandler(w http.ResponseWriter, r *http.Request) {
	repertoireID := r.PathValue("repertoireId")
	if repertoireID == "" {
		http.Error(w, "missing repertoireId", http.StatusBadRequest)
		return
	}
	err := cs.subscribe(w, r, repertoireID)
	if errors.Is(err, context.Canceled) {
		return
	}
	if websocket.CloseStatus(err) == websocket.StatusNormalClosure ||
		websocket.CloseStatus(err) == websocket.StatusGoingAway {
		return
	}
	if err != nil {
		cs.logf("%v", err)
		return
	}
}

// subscribe subscribes the given WebSocket to all broadcast messages.
// It creates a subscriber with a buffered msgs chan to give some room to slower
// connections and then registers the subscriber. It then listens for all messages
// and writes them to the WebSocket. If the context is cancelled or
// an error occurs, it returns and deletes the subscription.
//
// It uses CloseRead to keep reading from the connection to process control
// messages and cancel the context if the connection drops.
func (cs *chatServer) subscribe(w http.ResponseWriter, r *http.Request, repertoireID string) error {
	// authenticate the connection from the session cookie before upgrading.
	// we pin the user id to the subscriber so every message broadcast over
	// this connection is attributable to a known user.
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		http.Error(w, "missing session", http.StatusUnauthorized)
		return err
	}
	sess, err := fetchSession(cs.db, cookie.Value)
	if err != nil {
		http.Error(w, "session lookup failed", http.StatusInternalServerError)
		return err
	}
	if sess == nil {
		http.Error(w, "invalid or expired session", http.StatusUnauthorized)
		return errors.New("invalid or expired session")
	}

	s := &subscriber{
		msgs:   make(chan []byte, cs.subscriberMessageBuffer),
		userID: sess.UserID,
	}
	cs.join(repertoireID, s)
	defer cs.leave(s)

	c, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"localhost:5173"},
	})
	if err != nil {
		return err
	}
	defer c.CloseNow()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	// reader goroutine: pulls messages off the socket and dispatches them.
	// when the client disconnects (or sends garbage), cancel() trips the
	// writer loop below so we tear the connection down cleanly.
	go func() {
		defer cancel()
		for {
			_, data, err := c.Read(ctx)
			if err != nil {
				return
			}
			cs.handleWSMessage(s, data)
		}
	}()

	// writer loop: forwards broadcast messages to this subscriber.
	for {
		select {
		case msg := <-s.msgs:
			if err := writeTimeout(ctx, time.Second*5, c, msg); err != nil {
				return err
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// handleWSMessage matches the `type` field of an incoming WebSocket message
// to a server action. New ops are added by extending the switch.
func (cs *chatServer) handleWSMessage(s *subscriber, raw []byte) {
	var env struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(raw, &env); err != nil {
		cs.logf("invalid ws message from user %s: %v", s.userID, err)
		return
	}

	switch env.Type {
	case "move_created":
		var event MoveEvent
		if err := json.Unmarshal(raw, &event); err != nil {
			cs.logf("invalid move_created from user %s: %v", s.userID, err)
			return
		}
		if err := addMoveToChapter(cs.db, event); err != nil {
			cs.logf("persist move (user %s): %v", s.userID, err)
			return
		}
		cs.publishRoom(s.room, raw, s)

	case "node_deleted":
		var event NodeDeleteEvent
		if err := json.Unmarshal(raw, &event); err != nil {
			cs.logf("invalid node_deleted from user %s: %v", s.userID, err)
			return
		}
		if err := deleteNodeFromChapter(cs.db, event); err != nil {
			cs.logf("delete node (user %s): %v", s.userID, err)
			return
		}
		cs.publishRoom(s.room, raw, s)

	case "chapter_created":
		var event ChapterEvent
		if err := json.Unmarshal(raw, &event); err != nil {
			cs.logf("invalid chapter_created from user %s: %v", s.userID, err)
			return
		}
		if err := createChapter(cs.db, event); err != nil {
			cs.logf("persist chapter (user %s): %v", s.userID, err)
			return
		}
		cs.publishRoom(s.room, raw, s)

	default:
		cs.logf("unknown ws op %q from user %s", env.Type, s.userID)
	}
}

// join adds the subscriber to the named repertoire room, creating the room
// on first use. Pins s.room so publishRoom can find the peers later without
// another lookup.
func (cs *chatServer) join(repertoireID string, s *subscriber) {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	r, ok := cs.rooms[repertoireID]
	if !ok {
		r = &room{
			id:          repertoireID,
			subscribers: make(map[*subscriber]struct{}),
		}
		cs.rooms[repertoireID] = r
		cs.logf("created room for repertoire %s", repertoireID)
	}
	r.subscribers[s] = struct{}{}
	s.room = r
}

// leave removes the subscriber from its room and deletes the room entirely
// if it becomes empty so the map doesn't grow unbounded over time.
func (cs *chatServer) leave(s *subscriber) {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	r := s.room
	if r == nil {
		return
	}
	delete(r.subscribers, s)
	if len(r.subscribers) == 0 {
		delete(cs.rooms, r.id)
		cs.logf("destroyed empty room %s", r.id)
	}
}

// publishRoom fans a message out to every subscriber in the given room
// except the sender. Non-blocking: slow subscribers get evicted.
// Pass sender == nil to broadcast to every member of the room.
func (cs *chatServer) publishRoom(r *room, msg []byte, sender *subscriber) {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	for s := range r.subscribers {
		if s == sender {
			continue
		}
		select {
		case s.msgs <- msg:
		default:
			// Drop the slow subscriber. Can't call leave here (holds the
			// same mutex); schedule it on a goroutine instead.
			go cs.leave(s)
		}
	}
}

func writeTimeout(ctx context.Context, timeout time.Duration, c *websocket.Conn, msg []byte) error {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	return wsjson.Write(ctx, c, json.RawMessage(msg))
}
