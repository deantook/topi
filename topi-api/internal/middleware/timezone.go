package middleware

import (
	"github.com/deantook/topi-api/pkg/timezone"
	"github.com/gin-gonic/gin"
)

// Timezone 从请求头读取 X-Timezone / X-Timezone-Offset，解析并存入 context。
func Timezone() gin.HandlerFunc {
	return func(c *gin.Context) {
		tzName := c.GetHeader("X-Timezone")
		tzOffset := c.GetHeader("X-Timezone-Offset")
		loc := timezone.LoadFromHeaders(tzName, tzOffset)
		c.Set(timezone.ContextKey, loc)
		c.Next()
	}
}
