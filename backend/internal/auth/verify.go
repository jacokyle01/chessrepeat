package auth

import (
	"context"

	"google.golang.org/api/idtoken"
)

type GoogleClaims struct {
	Sub     string
	Email   string
	Name    string
	Picture string
}

func VerifyGoogleIDToken(ctx context.Context, raw string, googleClientID string) (*GoogleClaims, error) {
	payload, err := idtoken.Validate(ctx, raw, googleClientID)
	if err != nil {
		return nil, err
	}

	sub, _ := payload.Claims["sub"].(string)
	email, _ := payload.Claims["email"].(string)
	name, _ := payload.Claims["name"].(string)
	picture, _ := payload.Claims["picture"].(string)

	return &GoogleClaims{Sub: sub, Email: email, Name: name, Picture: picture}, nil
}
