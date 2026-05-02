package domain

// User is identified by their Google OAuth subject. Their repertoire is
// tracked in a sibling repertoires collection — the repertoire carries
// chapter pointers and the list of collaborators.
//
// TokenID and Email never appear on the wire — TokenID is an internal
// primary key and Email is PII we don't want leaking to collaborators.
// Public-facing identity is (username, picture) only.
type User struct {
	TokenID  string `json:"-"                  bson:"_id"`
	Username string `json:"username,omitempty" bson:"username,omitempty"`
	Email    string `json:"-"                  bson:"email"`
	Picture  string `json:"picture"            bson:"picture"`
}

// CollaboratorView is the per-side shape returned to the client. Usernames
// + pictures are resolved against the users collection at read time.
type CollaboratorView struct {
	Username string `json:"username"`
	Picture  string `json:"picture,omitempty"`
}

// PeerInfo is the public identity of a connected user, sent in
// crowd/join/leave messages over the WebSocket. Keyed by username
// rather than Google sub — peers can dedupe/filter without learning
// each other's OAuth subject.
type PeerInfo struct {
	Username string `json:"username"`
	Picture  string `json:"picture"`
}
