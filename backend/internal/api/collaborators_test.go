package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"chessrepeat/internal/domain"
)

func TestGetOutgoingCollaborators(t *testing.T) {
	fs := newFakeStore()
	sid := seedUser(t, fs, domain.User{TokenID: "owner-sub", Username: "owner", Email: "e"})
	if err := fs.UpsertUser(domain.User{TokenID: "bob-sub", Username: "bob", Email: "e", Picture: "pb"}); err != nil {
		t.Fatal(err)
	}
	if err := fs.AddCollaborator("owner-sub", "bob-sub"); err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	req := withSession(httptest.NewRequest("GET", "/collaborators/outgoing", nil), sid)
	GetOutgoingCollaborators(fs)(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d", rr.Code)
	}
	var body struct {
		Collaborators []domain.CollaboratorView `json:"collaborators"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body.Collaborators) != 1 || body.Collaborators[0].Username != "bob" {
		t.Errorf("collaborators = %#v", body.Collaborators)
	}
}

func TestGetIncomingCollaborators(t *testing.T) {
	fs := newFakeStore()
	sid := seedUser(t, fs, domain.User{TokenID: "me-sub", Username: "me", Email: "e"})
	if err := fs.UpsertUser(domain.User{TokenID: "owner-sub", Username: "owner", Email: "e"}); err != nil {
		t.Fatal(err)
	}
	if err := fs.AddCollaborator("owner-sub", "me-sub"); err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	req := withSession(httptest.NewRequest("GET", "/collaborators/incoming", nil), sid)
	GetIncomingCollaborators(fs)(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d", rr.Code)
	}
	var body struct {
		Collaborators []domain.CollaboratorView `json:"collaborators"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body.Collaborators) != 1 || body.Collaborators[0].Username != "owner" {
		t.Errorf("collaborators = %#v", body.Collaborators)
	}
}

func TestAddCollaborator_Success(t *testing.T) {
	fs := newFakeStore()
	sid := seedUser(t, fs, domain.User{TokenID: "owner-sub", Username: "owner", Email: "e"})
	if err := fs.UpsertUser(domain.User{TokenID: "bob-sub", Username: "bob", Email: "e", Picture: "pb"}); err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	req := withSession(newJSONRequest("POST", "/collaborators", `{"username":"bob"}`), sid)
	AddCollaborator(fs)(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, body=%s", rr.Code, rr.Body.String())
	}
	if _, ok := fs.collaborators[collabKey{"owner-sub", "bob-sub"}]; !ok {
		t.Fatal("collaborator not stored")
	}
	var body domain.CollaboratorView
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Username != "bob" || body.Picture != "pb" {
		t.Errorf("body = %#v", body)
	}
}

func TestAddCollaborator_RejectsSelf(t *testing.T) {
	fs := newFakeStore()
	sid := seedUser(t, fs, domain.User{TokenID: "alice-sub", Username: "alice", Email: "e"})

	rr := httptest.NewRecorder()
	req := withSession(newJSONRequest("POST", "/collaborators", `{"username":"alice"}`), sid)
	AddCollaborator(fs)(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rr.Code)
	}
}

func TestAddCollaborator_UnknownUser(t *testing.T) {
	fs := newFakeStore()
	sid := seedUser(t, fs, domain.User{TokenID: "alice-sub", Username: "alice", Email: "e"})

	rr := httptest.NewRecorder()
	req := withSession(newJSONRequest("POST", "/collaborators", `{"username":"ghost"}`), sid)
	AddCollaborator(fs)(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rr.Code)
	}
}

func TestAddCollaborator_MissingBody(t *testing.T) {
	fs := newFakeStore()
	sid := seedUser(t, fs, domain.User{TokenID: "alice-sub", Username: "alice", Email: "e"})

	rr := httptest.NewRecorder()
	req := withSession(newJSONRequest("POST", "/collaborators", `{}`), sid)
	AddCollaborator(fs)(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rr.Code)
	}
}

func TestAddCollaborator_Unauthorized(t *testing.T) {
	fs := newFakeStore()
	rr := httptest.NewRecorder()
	AddCollaborator(fs)(rr, newJSONRequest("POST", "/collaborators", `{"username":"bob"}`))
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rr.Code)
	}
}

func TestRemoveCollaborator_Success(t *testing.T) {
	fs := newFakeStore()
	sid := seedUser(t, fs, domain.User{TokenID: "owner-sub", Username: "owner", Email: "e"})
	if err := fs.UpsertUser(domain.User{TokenID: "bob-sub", Username: "bob", Email: "e"}); err != nil {
		t.Fatal(err)
	}
	if err := fs.AddCollaborator("owner-sub", "bob-sub"); err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	req := withSession(httptest.NewRequest("DELETE", "/collaborators/bob", nil), sid)
	req.SetPathValue("username", "bob")
	RemoveCollaborator(fs)(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("status = %d", rr.Code)
	}
	if _, ok := fs.collaborators[collabKey{"owner-sub", "bob-sub"}]; ok {
		t.Fatal("collaborator should be gone")
	}
}

func TestRemoveCollaborator_UnknownUser(t *testing.T) {
	fs := newFakeStore()
	sid := seedUser(t, fs, domain.User{TokenID: "alice-sub", Username: "alice", Email: "e"})

	rr := httptest.NewRecorder()
	req := withSession(httptest.NewRequest("DELETE", "/collaborators/ghost", nil), sid)
	req.SetPathValue("username", "ghost")
	RemoveCollaborator(fs)(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rr.Code)
	}
}
