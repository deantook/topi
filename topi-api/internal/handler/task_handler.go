package handler

import (
	"net/http"
	"time"

	"github.com/deantook/topi-api/internal/model"
	"github.com/deantook/topi-api/internal/middleware"
	"github.com/deantook/topi-api/internal/service"
	"github.com/deantook/topi-api/pkg/response"
	"github.com/deantook/topi-api/pkg/timezone"
	"github.com/gin-gonic/gin"
)

func formatTaskForResponse(t model.Task, loc *time.Location) map[string]interface{} {
	if loc == nil {
		loc = time.UTC
	}
	m := map[string]interface{}{
		"id": t.ID, "list_id": t.ListID, "title": t.Title,
		"completed": t.Completed, "priority": t.Priority, "status": t.Status,
		"sort_order": t.Order, "detail": t.Detail, "owner": t.Owner,
		"estimated_hours": t.EstimatedHours,
	}
	m["created_at"] = t.CreatedAt.In(loc).Format(timezone.Layout)
	if t.DueDate != nil {
		m["due_date"] = timezone.FormatUTCToLocal(*t.DueDate, loc)
	} else {
		m["due_date"] = nil
	}
	return m
}

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
	owner := c.Query("owner")
	date := c.Query("date")
	startDate := c.Query("startDate")
	endDate := c.Query("endDate")
	var lp *string
	if listID != "" {
		lp = &listID
	}
	var op *string
	if owner != "" {
		op = &owner
	}
	loc := time.UTC
	if val, exists := c.Get(timezone.ContextKey); exists && val != nil {
		if l, ok := val.(*time.Location); ok {
			loc = l
		}
	}
	tasks, err := h.svc.List(userID, filter, lp, op, date, startDate, endDate, loc)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	out := make([]map[string]interface{}, 0, len(tasks))
	for _, t := range tasks {
		out = append(out, formatTaskForResponse(t, loc))
	}
	response.OK(c, out)
}

type CreateTaskReq struct {
	Title           string  `json:"title" binding:"required"`
	ListID          *string `json:"listId"`
	DueDate         *string `json:"dueDate"`
	Priority        *string `json:"priority"`
	Detail          *string `json:"detail"`
	Owner           *string `json:"owner"`
	EstimatedHours  *int    `json:"estimated_hours"`
}

type CreateTasksBatchReq struct {
	Tasks []CreateTaskReq `json:"tasks"`
}

func (h *TaskHandler) Create(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	var req CreateTaskReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	var loc *time.Location
	if val, exists := c.Get(timezone.ContextKey); exists && val != nil {
		if l, ok := val.(*time.Location); ok {
			loc = l
		}
	}
	owner := model.TaskOwnerHumanPtr()
	if req.Owner != nil && *req.Owner == "agent" {
		owner = model.TaskOwnerAgentPtr()
	}
	t, err := h.svc.Create(userID, req.Title, req.ListID, req.DueDate, req.Priority, req.Detail, owner, req.EstimatedHours, loc)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	out := formatTaskForResponse(*t, loc)
	response.OK(c, out)
}

// CreateBatch godoc
// @Summary 批量创建任务
// @Tags tasks
// @Accept json
// @Produce json
// @Param Authorization header string true "Bearer token"
// @Param body body CreateTasksBatchReq true "任务列表"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /tasks/batch [post]
func (h *TaskHandler) CreateBatch(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	var req CreateTasksBatchReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if len(req.Tasks) == 0 {
		response.Error(c, http.StatusBadRequest, "tasks array must not be empty")
		return
	}
	inputs := make([]service.BatchTaskInput, len(req.Tasks))
	for i, t := range req.Tasks {
		inputs[i] = service.BatchTaskInput{
			Title:          t.Title,
			ListID:         t.ListID,
			DueDate:        t.DueDate,
			Priority:       t.Priority,
			Detail:         t.Detail,
			Owner:          t.Owner,
			EstimatedHours: t.EstimatedHours,
		}
	}
	var loc *time.Location
	if val, exists := c.Get(timezone.ContextKey); exists && val != nil {
		if l, ok := val.(*time.Location); ok {
			loc = l
		}
	}
	tasks, err := h.svc.BatchCreate(userID, inputs, model.TaskOwnerHumanPtr(), loc)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	out := make([]map[string]interface{}, 0, len(tasks))
	for _, t := range tasks {
		out = append(out, formatTaskForResponse(*t, loc))
	}
	response.OK(c, out)
}

type UpdateTaskReq struct {
	Title               *string `json:"title"`
	ListID              *string `json:"listId"`
	DueDate             *string `json:"dueDate"`
	Priority            *string `json:"priority"`
	Detail              *string `json:"detail"`
	Owner               *string `json:"owner"`
	EstimatedHours      *int    `json:"estimated_hours"`
	ClearEstimatedHours *bool   `json:"clear_estimated_hours"`
}

func (h *TaskHandler) Update(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	id := c.Param("id")
	var req UpdateTaskReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	var loc *time.Location
	if val, exists := c.Get(timezone.ContextKey); exists && val != nil {
		if l, ok := val.(*time.Location); ok {
			loc = l
		}
	}
	clearEstHours := req.ClearEstimatedHours != nil && *req.ClearEstimatedHours
	if err := h.svc.Update(userID, id, req.Title, req.ListID, req.DueDate, req.Priority, req.Detail, req.Owner, req.EstimatedHours, clearEstHours, loc); err != nil {
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
