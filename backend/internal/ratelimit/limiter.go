// Package ratelimit provides a small token-bucket rate limiter used by
// HTTP middleware (per IP) and the WebSocket dispatcher (per connection).
//
// The limiter is intentionally in-process. We run a single backend behind
// caddy, so a global map in memory is enough; if the service is ever
// scaled horizontally this needs a shared backend (redis, etc).
package ratelimit

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Bucket is a classic token bucket: capacity tokens, refilled at
// refillPerSecond. Allow consumes one token and returns false if the
// bucket is empty.
type Bucket struct {
	mu              sync.Mutex
	tokens          float64
	capacity        float64
	refillPerSecond float64
	last            time.Time
	now             func() time.Time
}

// NewBucket creates a bucket that starts full.
func NewBucket(capacity int, refillPerSecond float64) *Bucket {
	return newBucket(capacity, refillPerSecond, time.Now)
}

func newBucket(capacity int, refillPerSecond float64, now func() time.Time) *Bucket {
	return &Bucket{
		tokens:          float64(capacity),
		capacity:        float64(capacity),
		refillPerSecond: refillPerSecond,
		last:            now(),
		now:             now,
	}
}

// Allow consumes one token if available.
func (b *Bucket) Allow() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	now := b.now()
	elapsed := now.Sub(b.last).Seconds()
	if elapsed > 0 {
		b.tokens += elapsed * b.refillPerSecond
		if b.tokens > b.capacity {
			b.tokens = b.capacity
		}
		b.last = now
	}
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

// Limiter is a keyed map of buckets with idle-entry GC. Use one Limiter
// per logical bucket (one for /login, one for /username/check, etc.) so
// the rate budget for one endpoint can't be drained by traffic to
// another.
type Limiter struct {
	capacity        int
	refillPerSecond float64
	idle            time.Duration
	now             func() time.Time

	mu      sync.Mutex
	buckets map[string]*entry

	stop chan struct{}
}

type entry struct {
	bucket   *Bucket
	lastSeen time.Time
}

// New creates a Limiter and starts its GC loop. Capacity is the burst
// size; refillPerSecond is the steady-state rate. Buckets idle for
// longer than 10 minutes are evicted so a flood of unique keys can't
// grow the map without bound.
func New(capacity int, refillPerSecond float64) *Limiter {
	return newLimiter(capacity, refillPerSecond, 10*time.Minute, time.Now, true)
}

func newLimiter(capacity int, refillPerSecond float64, idle time.Duration, now func() time.Time, runGC bool) *Limiter {
	l := &Limiter{
		capacity:        capacity,
		refillPerSecond: refillPerSecond,
		idle:            idle,
		now:             now,
		buckets:         make(map[string]*entry),
		stop:            make(chan struct{}),
	}
	if runGC {
		go l.gcLoop()
	}
	return l
}

// Allow returns true if the request keyed by key has tokens left.
func (l *Limiter) Allow(key string) bool {
	l.mu.Lock()
	e, ok := l.buckets[key]
	if !ok {
		e = &entry{bucket: newBucket(l.capacity, l.refillPerSecond, l.now)}
		l.buckets[key] = e
	}
	e.lastSeen = l.now()
	b := e.bucket
	l.mu.Unlock()
	return b.Allow()
}

// Stop ends the background GC. Tests use it to avoid goroutine leaks.
func (l *Limiter) Stop() { close(l.stop) }

func (l *Limiter) gcLoop() {
	t := time.NewTicker(time.Minute)
	defer t.Stop()
	for {
		select {
		case <-l.stop:
			return
		case <-t.C:
			l.gc()
		}
	}
}

func (l *Limiter) gc() {
	cutoff := l.now().Add(-l.idle)
	l.mu.Lock()
	defer l.mu.Unlock()
	for k, e := range l.buckets {
		if e.lastSeen.Before(cutoff) {
			delete(l.buckets, k)
		}
	}
}

// Middleware wraps next with per-IP rate limiting. On rejection it
// writes 429 with a Retry-After hint.
func (l *Limiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !l.Allow(ClientIP(r)) {
			w.Header().Set("Retry-After", "60")
			http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// HandlerFunc is the http.HandlerFunc-shaped variant of Middleware. The
// router registers handlers as HandlerFuncs, so wrapping in-place is
// cleaner than threading them through http.Handler.
func (l *Limiter) HandlerFunc(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !l.Allow(ClientIP(r)) {
			w.Header().Set("Retry-After", "60")
			http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
			return
		}
		next(w, r)
	}
}

// ClientIP returns the request's originating IP. Behind caddy the real
// client IP is in the leftmost X-Forwarded-For entry; with no proxy we
// fall back to RemoteAddr. This trusts X-Forwarded-For unconditionally,
// which is fine because the backend is only reachable through caddy in
// production. Direct exposure would let a client spoof the header to
// bypass the limiter.
func ClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if i := strings.Index(xff, ","); i >= 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
