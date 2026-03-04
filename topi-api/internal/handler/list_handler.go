package handler

import (
	"net/http"
	"time"

	"github.com/deantook/topi-api/internal/middleware"
	"github.com/deantook/topi-api/internal/model"
	"github.com/deantook/topi-api/internal/service"
	"github.com/deantook/topi-api/pkg/response"
	"github.com/deantook/topi-api/pkg/timezone"
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
	loc := time.UTC
	if val, exists := c.Get(timezone.ContextKey); exists && val != nil {
		if l, ok := val.(*time.Location); ok {
			loc = l
		}
	}
	out := make([]map[string]interface{}, 0, len(lists))
	for _, l := range lists {
		out = append(out, formatListForResponse(l, loc))
	}
	response.OK(c, out)
}

func formatListForResponse(l model.List, loc *time.Location) map[string]interface{} {
	if loc == nil {
		loc = time.UTC
	}
	return map[string]interface{}{
		"id":         l.ID,
		"name":       l.Name,
		"created_at": l.CreatedAt.In(loc).Format(timezone.Layout),
	}
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
