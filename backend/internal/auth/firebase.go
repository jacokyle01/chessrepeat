package auth

import (
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// FirebaseClaims holds the subset of Firebase ID token claims we care
// about. UID is the Firebase user id and is what we key users on; for
// accounts imported from the old Google-only auth it equals the Google
// OAuth subject, so no row had to be rewritten during the migration.
type FirebaseClaims struct {
	UID           string
	Email         string
	EmailVerified bool
	Name          string
	Picture       string
	// SignInProvider is "google.com", "password", etc. — whichever
	// provider minted this particular token.
	SignInProvider string
}

// firebaseCertsURL serves the x509 certificates Firebase signs ID tokens
// with, keyed by kid. A package var so tests can point it at a local
// httptest server.
var firebaseCertsURL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"

// firebaseIssuerPrefix + project id is the required iss claim.
const firebaseIssuerPrefix = "https://securetoken.google.com/"

// clockLeeway absorbs small skew between our clock and Google's when
// checking exp / iat / auth_time.
const clockLeeway = time.Minute

// minRefetchInterval stops a flood of tokens with bogus kids from
// turning every login attempt into a round trip to Google.
const minRefetchInterval = time.Minute

// firebaseJWTClaims is the wire shape of a Firebase ID token payload.
type firebaseJWTClaims struct {
	jwt.RegisteredClaims
	Email         string           `json:"email"`
	EmailVerified bool             `json:"email_verified"`
	Name          string           `json:"name"`
	Picture       string           `json:"picture"`
	AuthTime      *jwt.NumericDate `json:"auth_time"`
	Firebase      struct {
		SignInProvider string `json:"sign_in_provider"`
	} `json:"firebase"`
}

// certCache holds Google's current signing keys. Keys rotate every few
// hours; the response's Cache-Control max-age says how long to trust
// the set we have. An unknown kid forces an early refresh (rotation
// happened before our TTL ran out), subject to minRefetchInterval.
type certCache struct {
	mu        sync.Mutex
	keys      map[string]*rsa.PublicKey
	expires   time.Time
	lastFetch time.Time
	client    *http.Client
}

var certs = &certCache{client: &http.Client{Timeout: 10 * time.Second}}

func (c *certCache) key(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()
	if now.Before(c.expires) {
		if k, ok := c.keys[kid]; ok {
			return k, nil
		}
	}
	if now.Sub(c.lastFetch) < minRefetchInterval {
		if k, ok := c.keys[kid]; ok {
			return k, nil
		}
		return nil, fmt.Errorf("unknown key id %q", kid)
	}
	if err := c.refresh(ctx); err != nil {
		return nil, err
	}
	if k, ok := c.keys[kid]; ok {
		return k, nil
	}
	return nil, fmt.Errorf("unknown key id %q", kid)
}

func (c *certCache) refresh(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, firebaseCertsURL, nil)
	if err != nil {
		return err
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("fetch firebase certs: %w", err)
	}
	defer resp.Body.Close()
	c.lastFetch = time.Now()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("fetch firebase certs: status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return err
	}
	var pems map[string]string
	if err := json.Unmarshal(body, &pems); err != nil {
		return fmt.Errorf("decode firebase certs: %w", err)
	}
	keys := make(map[string]*rsa.PublicKey, len(pems))
	for kid, p := range pems {
		block, _ := pem.Decode([]byte(p))
		if block == nil {
			return fmt.Errorf("cert %q: not PEM", kid)
		}
		cert, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			return fmt.Errorf("cert %q: %w", kid, err)
		}
		pub, ok := cert.PublicKey.(*rsa.PublicKey)
		if !ok {
			return fmt.Errorf("cert %q: not an RSA key", kid)
		}
		keys[kid] = pub
	}
	if len(keys) == 0 {
		return errors.New("firebase certs response contained no keys")
	}
	c.keys = keys
	c.expires = c.lastFetch.Add(maxAge(resp.Header.Get("Cache-Control")))
	return nil
}

// maxAge pulls max-age out of a Cache-Control header, falling back to
// an hour when absent or unparseable.
func maxAge(cacheControl string) time.Duration {
	for _, part := range strings.Split(cacheControl, ",") {
		part = strings.TrimSpace(part)
		if v, ok := strings.CutPrefix(part, "max-age="); ok {
			if secs, err := strconv.Atoi(v); err == nil && secs > 0 {
				return time.Duration(secs) * time.Second
			}
		}
	}
	return time.Hour
}

// VerifyFirebaseIDToken validates a Firebase-issued ID token per the
// rules in the Admin SDK docs: RS256 signature against Google's
// securetoken certs, aud == project id, iss == securetoken.google.com/
// <project id>, exp in the future, iat and auth_time in the past, and a
// non-empty sub. On success the sub is returned as UID.
func VerifyFirebaseIDToken(ctx context.Context, rawToken, projectID string) (*FirebaseClaims, error) {
	if projectID == "" {
		return nil, errors.New("firebase project id not configured")
	}

	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg()}),
		jwt.WithAudience(projectID),
		jwt.WithIssuer(firebaseIssuerPrefix+projectID),
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
		jwt.WithLeeway(clockLeeway),
	)
	var claims firebaseJWTClaims
	_, err := parser.ParseWithClaims(rawToken, &claims, func(t *jwt.Token) (any, error) {
		kid, _ := t.Header["kid"].(string)
		if kid == "" {
			return nil, errors.New("token missing kid header")
		}
		return certs.key(ctx, kid)
	})
	if err != nil {
		return nil, err
	}

	if claims.Subject == "" {
		return nil, errors.New("token missing sub claim")
	}
	if claims.AuthTime == nil {
		return nil, errors.New("token missing auth_time claim")
	}
	if claims.AuthTime.Time.After(time.Now().Add(clockLeeway)) {
		return nil, errors.New("token auth_time is in the future")
	}

	return &FirebaseClaims{
		UID:            claims.Subject,
		Email:          claims.Email,
		EmailVerified:  claims.EmailVerified,
		Name:           claims.Name,
		Picture:        claims.Picture,
		SignInProvider: claims.Firebase.SignInProvider,
	}, nil
}
