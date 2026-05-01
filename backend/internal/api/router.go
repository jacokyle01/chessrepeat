package api

import (
	"net/http"

	"chessrepeat/internal/store"
)

// Register attaches every HTTP handler to the given mux. The mux still
// owns CORS — wrap the result in WithCORS at the call site.
func Register(mux *http.ServeMux, db *store.DB) {
	mux.HandleFunc("GET /repertoire", GetRepertoire(db))
	mux.HandleFunc("/login", Login(db))
	mux.HandleFunc("/logout", Logout(db))

	mux.HandleFunc("GET /collaborators/outgoing", GetOutgoingCollaborators(db))
	mux.HandleFunc("GET /collaborators/incoming", GetIncomingCollaborators(db))
	mux.HandleFunc("POST /collaborators", AddCollaborator(db))
	mux.HandleFunc("DELETE /collaborators/{username}", RemoveCollaborator(db))
}
