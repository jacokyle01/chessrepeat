package domain

// User is identified by their Google OAuth subject. Their repertoire is
// tracked in a sibling repertoires collection — the repertoire carries
// chapter pointers and the list of collaborators.
type User struct {
	TokenID  string `json:"tokenId"            bson:"_id"`
	Username string `json:"username,omitempty" bson:"username,omitempty"`
	Email    string `json:"email"              bson:"email"`
	Picture  string `json:"picture"            bson:"picture"`
}

// CollaboratorView is the per-side shape returned to the client. Usernames
// + pictures are resolved against the users collection at read time.
type CollaboratorView struct {
	Username string `json:"username"`
	Picture  string `json:"picture,omitempty"`
}

// PeerInfo is the public identity of a connected user, sent in
// crowd/join/leave messages over the WebSocket.
type PeerInfo struct {
	UserID   string `json:"userId"`
	Username string `json:"username"`
	Picture  string `json:"picture"`
}
