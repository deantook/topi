package middleware

import (
	"net/http"
	"strings"

	"github.com/deantook/topi-api/pkg/jwt"
	"github.com/deantook/topi-api/pkg/response"
	"github.com/gin-gonic/gin"
)

const UserIDKey = "userId"

func Auth(jwtHelper *jwt.Helper) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.Query("token")
		if token == "" {
			if auth := c.GetHeader("Authorization"); auth != "" && strings.HasPrefix(auth, "Bearer ") {
				token = strings.TrimPrefix(auth, "Bearer ")
			}
		}
		if token == "" {
			response.Error(c, http.StatusUnauthorized, "unauthorized")
			c.Abort()
			return
		}
		claims, err := jwtHelper.Verify(token)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "unauthorized")
			c.Abort()
			return
		}
		c.Set(UserIDKey, claims.UserID)
		c.Next()
	}
}
