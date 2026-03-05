package handlers

import (
	"context"
	"encoding/json"
	"time"

	topimcp "github.com/deantook/topi-api/internal/mcp"
	"github.com/deantook/topi-api/internal/service"
	"github.com/mark3labs/mcp-go/mcp"
)

type TaskHandlers struct {
	TaskSvc *service.TaskService
}

func NewTaskHandlers(taskSvc *service.TaskService) *TaskHandlers {
	return &TaskHandlers{TaskSvc: taskSvc}
}

func (h *TaskHandlers) ListTasks(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := topimcp.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("unauthorized"), nil
	}
	filter := req.GetString("filter", "all")
	listID := req.GetString("listId", "")
	var lp *string
	if listID != "" {
		lp = &listID
	}
	date := req.GetString("date", "")
	startDate := req.GetString("startDate", "")
	endDate := req.GetString("endDate", "")
	tasks, err := h.TaskSvc.List(userID, filter, lp, date, startDate, endDate, time.UTC)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	out := make([]map[string]interface{}, 0, len(tasks))
	for _, t := range tasks {
		out = append(out, map[string]interface{}{
			"id":        t.ID,
			"title":     t.Title,
			"completed": t.Completed,
			"due_date":  t.DueDate,
			"priority":  t.Priority,
			"status":    t.Status,
		})
	}
	b, _ := json.Marshal(out)
	return mcp.NewToolResultText(string(b)), nil
}

func (h *TaskHandlers) CreateTask(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := topimcp.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("unauthorized"), nil
	}
	title, err := req.RequireString("title")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	listID := req.GetString("listId", "")
	var lp *string
	if listID != "" {
		lp = &listID
	}
	dueDate := req.GetString("dueDate", "")
	var dp *string
	if dueDate != "" {
		dp = &dueDate
	}
	priority := req.GetString("priority", "none")
	task, err := h.TaskSvc.Create(userID, title, lp, dp, &priority, time.UTC)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	b, _ := json.Marshal(map[string]interface{}{"id": task.ID, "title": task.Title})
	return mcp.NewToolResultText(string(b)), nil
}
