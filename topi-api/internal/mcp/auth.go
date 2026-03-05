package mcp

import (
	"net/http"
	"strings"

	"github.com/deantook/topi-api/pkg/jwt"
)

func ExtractUserIDFromRequest(jwtHelper *jwt.Helper, r *http.Request) (string, error) {
	token := r.URL.Query().Get("token")
	if token == "" {
		if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
			token = strings.TrimPrefix(h, "Bearer ")
		}
	}
	if token == "" {
		return "", nil
	}
	claims, err := jwtHelper.Verify(token)
	if err != nil {
		return "", err
	}
	return claims.UserID, nil
}

func AuthMiddleware(jwtHelper *jwt.Helper) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, err := ExtractUserIDFromRequest(jwtHelper, r)
			if err != nil || userID == "" {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
			ctx := ContextWithUserID(r.Context(), userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
