package middleware

import (
	"github.com/gin-gonic/gin"
)

func CORS(origin string) gin.HandlerFunc {
	return func(c *gin.Context) {
		allowOrigin := origin
		if allowOrigin == "" || allowOrigin == "*" {
			// 允许任意来源：回显请求的 Origin（支持带凭证）；无 Origin 时用 *
			allowOrigin = c.GetHeader("Origin")
			if allowOrigin == "" {
				allowOrigin = "*"
			} else {
				c.Header("Access-Control-Allow-Credentials", "true")
			}
		}
		c.Header("Access-Control-Allow-Origin", allowOrigin)
		c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Timezone, X-Timezone-Offset")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
