package middleware

import (
	"net/http"
	"strings"

	"github.com/deantook/topi-api/internal/service"
	"github.com/deantook/topi-api/pkg/response"
	"github.com/gin-gonic/gin"
)

func McpAuth(mcpTokenSvc *service.McpTokenService) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.Query("token")
		if token == "" {
			if auth := c.GetHeader("Authorization"); auth != "" {
				token = strings.TrimPrefix(auth, "Bearer ")
			}
		}
		if token == "" {
			response.Error(c, http.StatusUnauthorized, "unauthorized")
			c.Abort()
			return
		}
		userID, err := mcpTokenSvc.ValidateToken(token)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "unauthorized")
			c.Abort()
			return
		}
		c.Set(UserIDKey, userID)
		c.Next()
	}
}
