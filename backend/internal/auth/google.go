package auth

import (
	"context"
	"errors"

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
// claim matches the provided audience (GOOGLE_CLIENT_ID).
func VerifyGoogleIDToken(ctx context.Context, rawToken, audience string) (*GoogleClaims, error) {
	if audience == "" {
		return nil, errors.New("google client id not configured")
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
