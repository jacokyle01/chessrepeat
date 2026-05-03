package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"chessrepeat/internal/auth"
	"chessrepeat/internal/domain"
)

const testGoogleClientID = "test-google-client-id"

// stubVerifier replaces the package-level verifyGoogleIDToken for the
// duration of t. The replacement returns the supplied claims for every
// invocation; pass err to simulate an invalid id token.
func stubVerifier(t *testing.T, claims *auth.GoogleClaims, err error) {
	t.Helper()
	prev := verifyGoogleIDToken
	verifyGoogleIDToken = func(ctx context.Context, token, audience string) (*auth.GoogleClaims, error) {
		return claims, err
	}
	t.Cleanup(func() { verifyGoogleIDToken = prev })
}

// seedUser writes a user and gives them a session, returning the
// session id so callers can attach it as a cookie.
func seedUser(t *testing.T, fs *fakeStore, u domain.User) string {
	t.Helper()
	if err := fs.UpsertUser(u); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	sess, err := fs.CreateSession("session-"+u.TokenID, u.TokenID)
	if err != nil {
		t.Fatalf("seed session: %v", err)
	}
	return sess.SessionID
}

// withSession attaches the session cookie to req, mimicking what the
// browser does after Login set it.
func withSession(req *http.Request, sessionID string) *http.Request {
	req.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: sessionID})
	return req
}

func newJSONRequest(method, target, body string) *http.Request {
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	return req
}

// findCookie returns the named cookie from a recorded response, or nil
// if it wasn't set.
func findCookie(rr *httptest.ResponseRecorder, name string) *http.Cookie {
	for _, c := range rr.Result().Cookies() {
		if c.Name == name {
			return c
		}
	}
	return nil
}
