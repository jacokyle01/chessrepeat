package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"chessrepeat/internal/auth"
	"chessrepeat/internal/domain"
)

func TestLogin_NeedsUsernameOnFirstSignup(t *testing.T) {
	fs := newFakeStore()
	stubVerifier(t, &auth.GoogleClaims{Sub: "google-sub-1", Email: "alice@example.com", Picture: "pic"}, nil)

	rr := httptest.NewRecorder()
	Login(fs, testGoogleClientID)(rr, newJSONRequest("POST", "/login", `{"idToken":"tok"}`))

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rr.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["needsUsername"] != true {
		t.Fatalf("expected needsUsername=true, got %v", body)
	}
	// Crucially, no user/session was written yet.
	if _, ok := fs.usersByToken["google-sub-1"]; ok {
		t.Fatal("user should not be persisted before username is chosen")
	}
	if findCookie(rr, auth.SessionCookieName) != nil {
		t.Fatal("no session cookie should be set on the needs-username response")
	}
}

func TestLogin_InvalidIDToken(t *testing.T) {
	fs := newFakeStore()
	stubVerifier(t, nil, errors.New("bad token"))

	rr := httptest.NewRecorder()
	Login(fs, testGoogleClientID)(rr, newJSONRequest("POST", "/login", `{"idToken":"tok"}`))

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rr.Code)
	}
}

func TestLogin_RejectsInvalidUsername(t *testing.T) {
	fs := newFakeStore()
	stubVerifier(t, &auth.GoogleClaims{Sub: "sub", Email: "e@example.com"}, nil)

	rr := httptest.NewRecorder()
	Login(fs, testGoogleClientID)(rr, newJSONRequest("POST", "/login", `{"idToken":"tok","username":"NO"}`))

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (username too short / wrong case)", rr.Code)
	}
}

func TestLogin_UsernameTaken(t *testing.T) {
	fs := newFakeStore()
	if err := fs.UpsertUser(domain.User{TokenID: "other", Username: "alice", Email: "x"}); err != nil {
		t.Fatal(err)
	}
	stubVerifier(t, &auth.GoogleClaims{Sub: "new-sub", Email: "e@example.com"}, nil)

	rr := httptest.NewRecorder()
	Login(fs, testGoogleClientID)(rr, newJSONRequest("POST", "/login", `{"idToken":"tok","username":"alice"}`))

	if rr.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409", rr.Code)
	}
}

func TestLogin_SuccessNewUser_SetsCookiesAndReturnsRepertoire(t *testing.T) {
	fs := newFakeStore()
	stubVerifier(t, &auth.GoogleClaims{
		Sub:     "google-sub-1",
		Email:   "alice@example.com",
		Picture: "https://pic",
	}, nil)

	rr := httptest.NewRecorder()
	Login(fs, testGoogleClientID)(rr, newJSONRequest("POST", "/login", `{"idToken":"tok","username":"alice"}`))

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rr.Code, rr.Body.String())
	}
	if c := findCookie(rr, auth.SessionCookieName); c == nil || c.Value == "" {
		t.Fatal("session cookie missing")
	}
	if c := findCookie(rr, auth.SessionHintCookieName); c == nil || c.Value != "1" {
		t.Fatalf("hint cookie = %#v", c)
	}

	var body struct {
		User     domain.User                  `json:"user"`
		Chapters []domain.ChapterTreeResponse `json:"chapters"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.User.Username != "alice" {
		t.Errorf("username = %q, want %q", body.User.Username, "alice")
	}
	if body.Chapters == nil {
		t.Error("chapters should be non-nil empty slice for fresh user")
	}
	// User was persisted under the Google sub.
	if u, ok := fs.usersByToken["google-sub-1"]; !ok || u.Username != "alice" {
		t.Fatalf("user not persisted correctly: %#v", u)
	}
}

func TestLogin_ExistingUserKeepsUsername(t *testing.T) {
	fs := newFakeStore()
	if err := fs.UpsertUser(domain.User{TokenID: "sub", Username: "alice", Email: "e", Picture: "old"}); err != nil {
		t.Fatal(err)
	}
	// Returning user logs in again — no username in the body, but they
	// already have one so login proceeds and updates picture/email.
	stubVerifier(t, &auth.GoogleClaims{Sub: "sub", Email: "alice@example.com", Picture: "new"}, nil)

	rr := httptest.NewRecorder()
	Login(fs, testGoogleClientID)(rr, newJSONRequest("POST", "/login", `{"idToken":"tok"}`))

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d", rr.Code)
	}
	if got := fs.usersByToken["sub"].Picture; got != "new" {
		t.Errorf("picture = %q, want updated %q", got, "new")
	}
	if findCookie(rr, auth.SessionCookieName) == nil {
		t.Fatal("session cookie missing")
	}
}

func TestLogin_RejectsNonPOST(t *testing.T) {
	fs := newFakeStore()
	rr := httptest.NewRecorder()
	Login(fs, testGoogleClientID)(rr, httptest.NewRequest("GET", "/login", nil))
	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want 405", rr.Code)
	}
}

func TestLogout_DeletesSessionAndClearsCookies(t *testing.T) {
	fs := newFakeStore()
	sid := seedUser(t, fs, domain.User{TokenID: "alice-sub", Username: "alice", Email: "e"})

	rr := httptest.NewRecorder()
	req := withSession(httptest.NewRequest("POST", "/logout", nil), sid)
	Logout(fs)(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d", rr.Code)
	}
	if _, ok := fs.sessions[sid]; ok {
		t.Fatal("session should be deleted")
	}
	if c := findCookie(rr, auth.SessionCookieName); c == nil || c.MaxAge != -1 {
		t.Fatalf("session cookie not cleared: %#v", c)
	}
	if c := findCookie(rr, auth.SessionHintCookieName); c == nil || c.MaxAge != -1 {
		t.Fatalf("hint cookie not cleared: %#v", c)
	}
}

func TestLogout_WithoutCookieStillClears(t *testing.T) {
	fs := newFakeStore()
	rr := httptest.NewRecorder()
	Logout(fs)(rr, httptest.NewRequest("POST", "/logout", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d", rr.Code)
	}
}

func TestCheckUsername(t *testing.T) {
	fs := newFakeStore()
	if err := fs.UpsertUser(domain.User{TokenID: "t", Username: "alice", Email: "e"}); err != nil {
		t.Fatal(err)
	}

	cases := []struct {
		name      string
		query     string
		available bool
		reason    string
	}{
		{"taken", "alice", false, "taken"},
		{"available", "bob", true, ""},
		{"too short", "ab", false, "invalid"},
		// Mixed case is normalized to lowercase before the regex check,
		// so "ALICE" collapses to the existing "alice" — taken, not invalid.
		{"uppercase normalizes", "ALICE", false, "taken"},
		// A character outside [a-z0-9_] survives ToLower and fails the regex.
		{"invalid char", "alice!", false, "invalid"},
		{"empty", "", false, "invalid"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rr := httptest.NewRecorder()
			CheckUsername(fs)(rr, httptest.NewRequest("GET", "/username/check?username="+tc.query, nil))

			if rr.Code != http.StatusOK {
				t.Fatalf("status = %d", rr.Code)
			}
			var body struct {
				Available bool   `json:"available"`
				Reason    string `json:"reason"`
			}
			if err := json.NewDecoder(strings.NewReader(rr.Body.String())).Decode(&body); err != nil {
				t.Fatalf("decode: %v", err)
			}
			if body.Available != tc.available || body.Reason != tc.reason {
				t.Errorf("got {available:%v reason:%q}, want {%v %q}",
					body.Available, body.Reason, tc.available, tc.reason)
			}
		})
	}
}
