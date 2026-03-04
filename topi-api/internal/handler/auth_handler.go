package handler

import (
	"errors"
	"net/http"

	"github.com/deantook/topi-api/internal/service"
	"github.com/deantook/topi-api/pkg/response"
	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	auth *service.AuthService
}

func NewAuthHandler(auth *service.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

type RegisterReq struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginReq struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// Register godoc
// @Summary 用户注册
// @Tags auth
// @Accept json
// @Produce json
// @Param body body RegisterReq true "注册信息"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /register [post]
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	u, err := h.auth.Register(req.Username, req.Password)
	if err != nil {
		if errors.Is(err, service.ErrUserExists) {
			response.Error(c, http.StatusConflict, "username already exists")
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"id": u.ID, "username": u.Username})
}

// Login godoc
// @Summary 用户登录
// @Tags auth
// @Accept json
// @Produce json
// @Param body body LoginReq true "登录信息"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	token, err := h.auth.Login(req.Username, req.Password)
	if err != nil {
		if errors.Is(err, service.ErrInvalidCreds) {
			response.Error(c, http.StatusUnauthorized, "invalid credentials")
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"token": token})
}
