package handler

import (
	"net/http"

	"github.com/deantook/topi-api/internal/middleware"
	"github.com/deantook/topi-api/internal/service"
	"github.com/deantook/topi-api/pkg/response"
	"github.com/gin-gonic/gin"
)

type TaskHandler struct {
	svc *service.TaskService
}

func NewTaskHandler(svc *service.TaskService) *TaskHandler {
	return &TaskHandler{svc: svc}
}

func (h *TaskHandler) List(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	filter := c.DefaultQuery("filter", "all")
	listID := c.Query("listId")
	var lp *string
	if listID != "" {
		lp = &listID
	}
	tasks, err := h.svc.List(userID, filter, lp)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, tasks)
}

type CreateTaskReq struct {
	Title   string  `json:"title" binding:"required"`
	ListID  *string `json:"listId"`
	DueDate *string `json:"dueDate"`
}

func (h *TaskHandler) Create(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	var req CreateTaskReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	t, err := h.svc.Create(userID, req.Title, req.ListID, req.DueDate)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, t)
}

type UpdateTaskReq struct {
	Title   *string `json:"title"`
	ListID  *string `json:"listId"`
	DueDate *string `json:"dueDate"`
}

func (h *TaskHandler) Update(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	id := c.Param("id")
	var req UpdateTaskReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.svc.Update(userID, id, req.Title, req.ListID, req.DueDate); err != nil {
		if err == service.ErrTaskNotFound {
			response.Error(c, http.StatusNotFound, "task not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}

func (h *TaskHandler) Toggle(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	id := c.Param("id")
	if err := h.svc.Toggle(userID, id); err != nil {
		if err == service.ErrTaskNotFound {
			response.Error(c, http.StatusNotFound, "task not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}

func (h *TaskHandler) Abandon(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	id := c.Param("id")
	if err := h.svc.Abandon(userID, id); err != nil {
		if err == service.ErrTaskNotFound {
			response.Error(c, http.StatusNotFound, "task not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}

func (h *TaskHandler) Restore(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	id := c.Param("id")
	if err := h.svc.Restore(userID, id); err != nil {
		if err == service.ErrTaskNotFound {
			response.Error(c, http.StatusNotFound, "task not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}

func (h *TaskHandler) Trash(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	id := c.Param("id")
	if err := h.svc.MoveToTrash(userID, id); err != nil {
		if err == service.ErrTaskNotFound {
			response.Error(c, http.StatusNotFound, "task not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}

func (h *TaskHandler) Delete(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	id := c.Param("id")
	if err := h.svc.Delete(userID, id); err != nil {
		if err == service.ErrTaskNotFound {
			response.Error(c, http.StatusNotFound, "task not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}

type ReorderTaskReq struct {
	ID       string `json:"id" binding:"required"`
	NewIndex int    `json:"newIndex" binding:"gte=0"`
}

func (h *TaskHandler) Reorder(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	var req ReorderTaskReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.svc.Reorder(userID, req.ID, req.NewIndex); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}
