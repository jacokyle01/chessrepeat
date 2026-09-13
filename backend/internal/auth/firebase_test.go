package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testProject = "chessrepeat-test"

// testSigner is an RSA key plus a self-signed cert for it, served the
// way Google serves securetoken certs: {"<kid>": "<PEM>"}.
type testSigner struct {
	key *rsa.PrivateKey
	kid string
	pem string
}

func newTestSigner(t *testing.T, kid string) *testSigner {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "securetoken test"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	p := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	return &testSigner{key: key, kid: kid, pem: string(p)}
}

// serveCerts points firebaseCertsURL at a test server for the duration
// of t and resets the package cert cache so each test starts cold.
func serveCerts(t *testing.T, signers ...*testSigner) {
	t.Helper()
	body := map[string]string{}
	for _, s := range signers {
		body[s.kid] = s.pem
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "public, max-age=3600")
		json.NewEncoder(w).Encode(body)
	}))
	prevURL := firebaseCertsURL
	prevCerts := certs
	firebaseCertsURL = srv.URL
	certs = &certCache{client: srv.Client()}
	t.Cleanup(func() {
		srv.Close()
		firebaseCertsURL = prevURL
		certs = prevCerts
	})
}

func (s *testSigner) sign(t *testing.T, claims firebaseJWTClaims, kid string) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tok.Header["kid"] = kid
	signed, err := tok.SignedString(s.key)
	if err != nil {
		t.Fatal(err)
	}
	return signed
}

func validClaims() firebaseJWTClaims {
	now := time.Now()
	c := firebaseJWTClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    firebaseIssuerPrefix + testProject,
			Audience:  jwt.ClaimStrings{testProject},
			Subject:   "uid-123",
			IssuedAt:  jwt.NewNumericDate(now.Add(-time.Minute)),
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)),
		},
		Email:         "alice@example.com",
		EmailVerified: true,
		Name:          "Alice",
		Picture:       "https://pic",
		AuthTime:      jwt.NewNumericDate(now.Add(-time.Minute)),
	}
	c.Firebase.SignInProvider = "google.com"
	return c
}

func TestVerifyFirebaseIDToken_Valid(t *testing.T) {
	s := newTestSigner(t, "k1")
	serveCerts(t, s)

	got, err := VerifyFirebaseIDToken(context.Background(), s.sign(t, validClaims(), "k1"), testProject)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if got.UID != "uid-123" || got.Email != "alice@example.com" || !got.EmailVerified ||
		got.Picture != "https://pic" || got.SignInProvider != "google.com" {
		t.Errorf("claims = %+v", got)
	}
}

func TestVerifyFirebaseIDToken_Rejects(t *testing.T) {
	s := newTestSigner(t, "k1")
	other := newTestSigner(t, "k2")
	serveCerts(t, s)

	cases := map[string]func() (string, string){
		"wrong audience": func() (string, string) {
			c := validClaims()
			c.Audience = jwt.ClaimStrings{"someone-else"}
			return s.sign(t, c, "k1"), testProject
		},
		"wrong issuer": func() (string, string) {
			c := validClaims()
			c.Issuer = firebaseIssuerPrefix + "someone-else"
			return s.sign(t, c, "k1"), testProject
		},
		"expired": func() (string, string) {
			c := validClaims()
			c.ExpiresAt = jwt.NewNumericDate(time.Now().Add(-2 * clockLeeway))
			return s.sign(t, c, "k1"), testProject
		},
		"issued in the future": func() (string, string) {
			c := validClaims()
			c.IssuedAt = jwt.NewNumericDate(time.Now().Add(2 * clockLeeway))
			return s.sign(t, c, "k1"), testProject
		},
		"auth_time in the future": func() (string, string) {
			c := validClaims()
			c.AuthTime = jwt.NewNumericDate(time.Now().Add(2 * clockLeeway))
			return s.sign(t, c, "k1"), testProject
		},
		"missing sub": func() (string, string) {
			c := validClaims()
			c.Subject = ""
			return s.sign(t, c, "k1"), testProject
		},
		"unknown kid": func() (string, string) {
			return other.sign(t, validClaims(), "k2"), testProject
		},
		"signed by a key we don't serve": func() (string, string) {
			// right kid, wrong private key
			return other.sign(t, validClaims(), "k1"), testProject
		},
		"no project configured": func() (string, string) {
			return s.sign(t, validClaims(), "k1"), ""
		},
		"garbage": func() (string, string) {
			return "not.a.jwt", testProject
		},
	}
	for name, mk := range cases {
		t.Run(name, func(t *testing.T) {
			tok, project := mk()
			if _, err := VerifyFirebaseIDToken(context.Background(), tok, project); err == nil {
				t.Fatal("expected error, got nil")
			}
		})
	}
}

func TestVerifyFirebaseIDToken_RejectsHS256(t *testing.T) {
	s := newTestSigner(t, "k1")
	serveCerts(t, s)

	// alg-confusion: a token HMAC-signed with the public key bytes must
	// not verify even though the kid is known.
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, validClaims())
	tok.Header["kid"] = "k1"
	signed, err := tok.SignedString([]byte("whatever"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := VerifyFirebaseIDToken(context.Background(), signed, testProject); err == nil {
		t.Fatal("HS256 token verified")
	}
}

func TestMaxAge(t *testing.T) {
	if got := maxAge("public, max-age=19730, must-revalidate"); got != 19730*time.Second {
		t.Errorf("got %v", got)
	}
	if got := maxAge(""); got != time.Hour {
		t.Errorf("fallback got %v", got)
	}
}
