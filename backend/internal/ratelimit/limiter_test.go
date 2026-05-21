package ratelimit

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestBucket_AllowsBurstThenRejects(t *testing.T) {
	now := time.Unix(0, 0)
	b := newBucket(3, 1, func() time.Time { return now })

	for i := 0; i < 3; i++ {
		if !b.Allow() {
			t.Fatalf("burst token %d should be allowed", i)
		}
	}
	if b.Allow() {
		t.Fatal("4th token in same instant should be rejected")
	}
}

func TestBucket_RefillsOverTime(t *testing.T) {
	now := time.Unix(0, 0)
	clock := func() time.Time { return now }
	b := newBucket(2, 1, clock)

	if !b.Allow() || !b.Allow() {
		t.Fatal("should allow initial burst")
	}
	if b.Allow() {
		t.Fatal("bucket should be empty")
	}
	now = now.Add(2 * time.Second)
	if !b.Allow() || !b.Allow() {
		t.Fatal("should refill 2 tokens after 2s")
	}
	if b.Allow() {
		t.Fatal("should be empty again")
	}
}

func TestBucket_RefillCapsAtCapacity(t *testing.T) {
	now := time.Unix(0, 0)
	clock := func() time.Time { return now }
	b := newBucket(2, 1, clock)
	b.Allow()
	b.Allow()
	now = now.Add(time.Hour)
	if !b.Allow() || !b.Allow() {
		t.Fatal("should refill to capacity")
	}
	if b.Allow() {
		t.Fatal("should not exceed capacity")
	}
}

func TestLimiter_KeysAreIndependent(t *testing.T) {
	l := newLimiter(1, 0, time.Hour, time.Now, false)
	if !l.Allow("a") {
		t.Fatal("first request for a should pass")
	}
	if l.Allow("a") {
		t.Fatal("second request for a should be rejected")
	}
	if !l.Allow("b") {
		t.Fatal("b has its own bucket")
	}
}

func TestLimiter_GCEvictsIdle(t *testing.T) {
	now := time.Unix(0, 0)
	clock := func() time.Time { return now }
	l := newLimiter(1, 0, time.Minute, clock, false)
	l.Allow("a")
	now = now.Add(2 * time.Minute)
	l.gc()
	l.mu.Lock()
	_, present := l.buckets["a"]
	l.mu.Unlock()
	if present {
		t.Fatal("idle bucket should have been evicted")
	}
}

func TestMiddleware_Returns429WhenExhausted(t *testing.T) {
	l := newLimiter(2, 0, time.Hour, time.Now, false)
	var hits int32
	h := l.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&hits, 1)
		w.WriteHeader(http.StatusOK)
	})

	for i := 0; i < 4; i++ {
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("POST", "/login", nil)
		req.RemoteAddr = "10.0.0.1:1234"
		h(rr, req)
		switch i {
		case 0, 1:
			if rr.Code != http.StatusOK {
				t.Errorf("req %d: status = %d, want 200", i, rr.Code)
			}
		default:
			if rr.Code != http.StatusTooManyRequests {
				t.Errorf("req %d: status = %d, want 429", i, rr.Code)
			}
			if rr.Header().Get("Retry-After") == "" {
				t.Errorf("req %d: missing Retry-After header", i)
			}
		}
	}
	if got := atomic.LoadInt32(&hits); got != 2 {
		t.Errorf("handler invoked %d times, want 2", got)
	}
}

func TestClientIP_PrefersXForwardedFor(t *testing.T) {
	cases := []struct {
		name string
		xff  string
		ra   string
		want string
	}{
		{"no xff", "", "10.0.0.5:9999", "10.0.0.5"},
		{"single xff", "203.0.113.7", "10.0.0.5:9999", "203.0.113.7"},
		{"chained xff takes leftmost", "203.0.113.7, 10.0.0.5", "10.0.0.5:9999", "203.0.113.7"},
		{"xff with whitespace", "  203.0.113.7  ", "10.0.0.5:9999", "203.0.113.7"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/", nil)
			r.RemoteAddr = tc.ra
			if tc.xff != "" {
				r.Header.Set("X-Forwarded-For", tc.xff)
			}
			if got := ClientIP(r); got != tc.want {
				t.Errorf("got %q, want %q", got, tc.want)
			}
		})
	}
}
