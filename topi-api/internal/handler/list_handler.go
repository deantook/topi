package handler

import (
	"net/http"

	"github.com/deantook/topi-api/internal/middleware"
	"github.com/deantook/topi-api/internal/service"
	"github.com/deantook/topi-api/pkg/response"
	"github.com/gin-gonic/gin"
)

type ListHandler struct {
	svc *service.ListService
}

func NewListHandler(svc *service.ListService) *ListHandler {
	return &ListHandler{svc: svc}
}

func (h *ListHandler) List(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	lists, err := h.svc.List(userID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, lists)
}

type CreateListReq struct {
	Name string `json:"name" binding:"required"`
}

func (h *ListHandler) Create(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	var req CreateListReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	l, err := h.svc.Create(userID, req.Name)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, l)
}

type UpdateListReq struct {
	Name string `json:"name" binding:"required"`
}

func (h *ListHandler) Update(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	id := c.Param("id")
	var req UpdateListReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.svc.Update(userID, id, req.Name); err != nil {
		if err == service.ErrListNotFound {
			response.Error(c, http.StatusNotFound, "list not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}

func (h *ListHandler) Delete(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	id := c.Param("id")
	if err := h.svc.Delete(userID, id); err != nil {
		if err == service.ErrListNotFound {
			response.Error(c, http.StatusNotFound, "list not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}
