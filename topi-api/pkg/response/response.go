package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// OK sends a successful JSON response with data.
func OK(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// Error sends an error JSON response.
func Error(c *gin.Context, code int, msg string) {
	c.JSON(code, gin.H{"error": msg})
}
