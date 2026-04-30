package auth

import (
	"context"
	"errors"
	"os"

	"google.golang.org/api/idtoken"
)

// GoogleClaims holds the subset of Google ID token claims we care about.
type GoogleClaims struct {
	Sub     string
	Name    string
	Email   string
	Picture string
}

// VerifyGoogleIDToken validates a Google-issued ID token. It checks
// signature (against Google's JWKS), issuer, expiry, and that the aud
// claim matches GOOGLE_CLIENT_ID.
func VerifyGoogleIDToken(ctx context.Context, rawToken string) (*GoogleClaims, error) {
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

	return &GoogleClaims{
		Sub:     sub,
		Name:    name,
		Email:   email,
		Picture: picture,
	}, nil
}
