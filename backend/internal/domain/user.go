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

// Permission values stored in the collaborators table and surfaced on
// CollaboratorView / PeerInfo. The owner of a repertoire is implicitly
// PermissionOwner (no row in collaborators); collaborator rows carry
// either PermissionEdit or PermissionTrain.
const (
	PermissionOwner = "owner"
	PermissionEdit  = "edit"
	PermissionTrain = "train"
)

// CanEdit reports whether perm grants chapter/move CRUD. Used by the WS
// dispatch layer to gate every non-training mutation.
func CanEdit(perm string) bool {
	return perm == PermissionOwner || perm == PermissionEdit
}

// CanTrain reports whether perm grants persistent training updates.
// Edit and owner trivially imply train; PermissionTrain is the
// learner-only role.
func CanTrain(perm string) bool {
	return perm == PermissionOwner || perm == PermissionEdit || perm == PermissionTrain
}

// CollaboratorView is the per-side shape returned to the client. Usernames
// + pictures are resolved against the users collection at read time.
// Permission is the row's stored permission ('edit' or 'train').
type CollaboratorView struct {
	Username   string `json:"username"`
	Picture    string `json:"picture,omitempty"`
	Permission string `json:"permission"`
}

// PeerInfo is the public identity of a connected user, sent in
// crowd/join/leave messages over the WebSocket. Keyed by username
// rather than Google sub — peers can dedupe/filter without learning
// each other's OAuth subject. Permission lets the UI color a peer by
// their role (owner / edit / train).
type PeerInfo struct {
	Username   string `json:"username"`
	Picture    string `json:"picture"`
	Permission string `json:"permission"`
}
