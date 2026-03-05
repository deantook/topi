package middleware

import (
	"github.com/deantook/topi-api/internal/mcp"
	"github.com/gin-gonic/gin"
)

// InjectUserIDForMCP copies userID from gin context (set by Auth) into the HTTP request
// context so MCP tool handlers can access it via mcp.UserIDFromContext.
// Must be used after Auth middleware.
func InjectUserIDForMCP() gin.HandlerFunc {
	return func(c *gin.Context) {
		if userID, exists := c.Get(UserIDKey); exists {
			if uid, ok := userID.(string); ok {
				c.Request = c.Request.WithContext(mcp.ContextWithUserID(c.Request.Context(), uid))
			}
		}
		c.Next()
	}
}
