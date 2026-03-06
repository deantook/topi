package handler

import (
	"net/http"

	"github.com/deantook/topi-api/internal/middleware"
	"github.com/deantook/topi-api/internal/service"
	"github.com/deantook/topi-api/pkg/response"
	"github.com/gin-gonic/gin"
)

type McpTokenHandler struct {
	svc *service.McpTokenService
}

func NewMcpTokenHandler(svc *service.McpTokenService) *McpTokenHandler {
	return &McpTokenHandler{svc: svc}
}

func (h *McpTokenHandler) GetStatus(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	if userID == "" {
		response.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	hasToken, prefix, err := h.svc.GetStatus(userID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	res := gin.H{"hasToken": hasToken}
	if hasToken {
		res["prefix"] = prefix
	}
	response.OK(c, res)
}

func (h *McpTokenHandler) Generate(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	if userID == "" {
		response.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	token, err := h.svc.Generate(userID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{
		"token":   token,
		"message": "请妥善保存，此令牌仅显示一次",
	})
}

func (h *McpTokenHandler) Revoke(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	if userID == "" {
		response.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	if err := h.svc.Revoke(userID); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"message": "已撤销"})
}
