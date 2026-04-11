package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"os"

	"google.golang.org/api/idtoken"
)

// googleClaims holds the subset of Google ID token claims we care about.
type googleClaims struct {
	Sub     string
	Name    string
	Email   string
	Picture string
}

// verifyGoogleIDToken validates a Google-issued ID token.
// It checks signature (against Google's JWKS), issuer, expiry, and that the
// aud claim matches GOOGLE_CLIENT_ID.
func verifyGoogleIDToken(ctx context.Context, rawToken string) (*googleClaims, error) {
	audience := os.Getenv("GOOGLE_CLIENT_ID")
	if audience == "" {
		return nil, errors.New("GOOGLE_CLIENT_ID env var not set")
	}

	payload, err := idtoken.Validate(ctx, rawToken, audience)
	if err != nil {
		return nil, err
	}

	sub, _ := payload.Claims["sub"].(string)
	if sub == "" {
		return nil, errors.New("token missing sub claim")
	}
	name, _ := payload.Claims["name"].(string)
	email, _ := payload.Claims["email"].(string)
	picture, _ := payload.Claims["picture"].(string)

	return &googleClaims{
		Sub:     sub,
		Name:    name,
		Email:   email,
		Picture: picture,
	}, nil
}

// newSessionID returns a cryptographically random opaque session id.
func newSessionID() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
