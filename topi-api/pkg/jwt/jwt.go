package jwt

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var ErrInvalidToken = errors.New("invalid token")

type Claims struct {
	UserID string `json:"userId"`
	jwt.RegisteredClaims
}

type Helper struct {
	secret []byte
	expire time.Duration
}

func NewHelper(secret string, expireHours int) *Helper {
	return &Helper{
		secret: []byte(secret),
		expire: time.Duration(expireHours) * time.Hour,
	}
}

func (h *Helper) Sign(userID string) (string, error) {
	claims := Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(h.expire)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(h.secret)
}

func (h *Helper) Verify(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		return h.secret, nil
	})
	if err != nil {
		return nil, ErrInvalidToken
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}
	return claims, nil
}
