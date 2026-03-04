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
		auth := c.GetHeader("Authorization")
		if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
			response.Error(c, http.StatusUnauthorized, "unauthorized")
			c.Abort()
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
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
