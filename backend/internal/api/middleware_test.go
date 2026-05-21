package api

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestWithRequestTimeout_DeadlineThreadsThroughContext(t *testing.T) {
	var gotErr error
	h := WithRequestTimeout(5*time.Millisecond, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-time.After(50 * time.Millisecond):
			gotErr = errors.New("handler ran past deadline")
		case <-r.Context().Done():
			gotErr = r.Context().Err()
		}
	}))

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest("GET", "/", nil))

	if !errors.Is(gotErr, context.DeadlineExceeded) {
		t.Fatalf("ctx err = %v, want DeadlineExceeded", gotErr)
	}
}

func TestWithRequestTimeout_DoesNotFireOnFastHandler(t *testing.T) {
	called := false
	h := WithRequestTimeout(time.Second, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest("GET", "/", nil))

	if !called {
		t.Fatal("handler not invoked")
	}
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rr.Code)
	}
}
