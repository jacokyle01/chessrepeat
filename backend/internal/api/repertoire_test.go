package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"chessrepeat/internal/domain"
)

func TestGetRepertoire_Unauthorized(t *testing.T) {
	fs := newFakeStore()
	rr := httptest.NewRecorder()
	GetRepertoire(fs)(rr, httptest.NewRequest("GET", "/repertoire", nil))
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rr.Code)
	}
}

func TestGetRepertoire_OwnRepertoire(t *testing.T) {
	fs := newFakeStore()
	sid := seedUser(t, fs, domain.User{TokenID: "alice-sub", Username: "alice", Email: "e"})
	fs.chapters["alice-sub"] = []domain.ChapterTreeResponse{{UUID: "c1", Name: "Sicilian"}}

	rr := httptest.NewRecorder()
	req := withSession(httptest.NewRequest("GET", "/repertoire", nil), sid)
	GetRepertoire(fs)(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rr.Code, rr.Body.String())
	}
	var body struct {
		User     domain.User                  `json:"user"`
		Chapters []domain.ChapterTreeResponse `json:"chapters"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.User.Username != "alice" {
		t.Errorf("user = %#v", body.User)
	}
	if len(body.Chapters) != 1 || body.Chapters[0].UUID != "c1" {
		t.Errorf("chapters = %#v", body.Chapters)
	}
}

func TestGetRepertoire_OtherOwnerForbidden(t *testing.T) {
	fs := newFakeStore()
	sid := seedUser(t, fs, domain.User{TokenID: "viewer-sub", Username: "viewer", Email: "e"})
	if err := fs.UpsertUser(domain.User{TokenID: "owner-sub", Username: "owner", Email: "e"}); err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	req := withSession(httptest.NewRequest("GET", "/repertoire?owner=owner", nil), sid)
	GetRepertoire(fs)(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rr.Code)
	}
}

func TestGetRepertoire_OtherOwnerAllowedAsCollaborator(t *testing.T) {
	fs := newFakeStore()
	sid := seedUser(t, fs, domain.User{TokenID: "viewer-sub", Username: "viewer", Email: "e"})
	if err := fs.UpsertUser(domain.User{TokenID: "owner-sub", Username: "owner", Email: "e"}); err != nil {
		t.Fatal(err)
	}
	if err := fs.AddCollaborator("owner-sub", "viewer-sub"); err != nil {
		t.Fatal(err)
	}
	fs.chapters["owner-sub"] = []domain.ChapterTreeResponse{{UUID: "x", Name: "shared"}}

	rr := httptest.NewRecorder()
	req := withSession(httptest.NewRequest("GET", "/repertoire?owner=owner", nil), sid)
	GetRepertoire(fs)(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d", rr.Code)
	}
	var body struct {
		Chapters []domain.ChapterTreeResponse `json:"chapters"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body.Chapters) != 1 || body.Chapters[0].UUID != "x" {
		t.Errorf("chapters = %#v", body.Chapters)
	}
}

func TestGetRepertoire_UnknownOwner(t *testing.T) {
	fs := newFakeStore()
	sid := seedUser(t, fs, domain.User{TokenID: "alice-sub", Username: "alice", Email: "e"})

	rr := httptest.NewRecorder()
	req := withSession(httptest.NewRequest("GET", "/repertoire?owner=nobody", nil), sid)
	GetRepertoire(fs)(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rr.Code)
	}
}
