package handlers

import (
	"context"
	"encoding/json"
	"fmt"
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
	owner := req.GetString("owner", "")
	var lp *string
	if listID != "" {
		lp = &listID
	}
	var op *string
	if owner != "" {
		op = &owner
	}
	date := req.GetString("date", "")
	startDate := req.GetString("startDate", "")
	endDate := req.GetString("endDate", "")
	tasks, err := h.TaskSvc.List(userID, filter, lp, op, date, startDate, endDate, time.UTC)
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
			"detail":    t.Detail,
		})
	}
	b, _ := json.Marshal(out)
	return mcp.NewToolResultText(string(b)), nil
}

func (h *TaskHandlers) CreateTasks(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := topimcp.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("unauthorized"), nil
	}
	tasksStr, err := req.RequireString("tasks")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	var parsed []map[string]interface{}
	if err := json.Unmarshal([]byte(tasksStr), &parsed); err != nil {
		return mcp.NewToolResultError("tasks must be a valid JSON array"), nil
	}
	if len(parsed) == 0 {
		return mcp.NewToolResultError("tasks must be a non-empty array"), nil
	}
	inputs := make([]service.BatchTaskInput, 0, len(parsed))
	for i, m := range parsed {
		titleVal, ok := m["title"]
		if !ok || titleVal == nil {
			return mcp.NewToolResultError(fmt.Sprintf("task[%d]: title is required", i)), nil
		}
		title, _ := titleVal.(string)
		if title == "" {
			return mcp.NewToolResultError(fmt.Sprintf("task[%d]: title is required", i)), nil
		}
		inp := service.BatchTaskInput{Title: title}
		if v, ok := m["listId"]; ok && v != nil {
			if s, ok := v.(string); ok {
				inp.ListID = &s
			}
		}
		if v, ok := m["dueDate"]; ok && v != nil {
			if s, ok := v.(string); ok {
				inp.DueDate = &s
			}
		}
		if v, ok := m["priority"]; ok && v != nil {
			if s, ok := v.(string); ok {
				inp.Priority = &s
			}
		}
		if v, ok := m["detail"]; ok && v != nil {
			if s, ok := v.(string); ok {
				inp.Detail = &s
			}
		}
		inputs = append(inputs, inp)
	}
	created, err := h.TaskSvc.BatchCreate(userID, inputs, time.UTC)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	out := make([]map[string]interface{}, 0, len(created))
	for _, t := range created {
		out = append(out, map[string]interface{}{
			"id":    t.ID,
			"title": t.Title,
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
	detail := req.GetString("detail", "")
	var dpDetail *string
	if detail != "" {
		dpDetail = &detail
	}
	task, err := h.TaskSvc.Create(userID, title, lp, dp, &priority, dpDetail, time.UTC)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	b, _ := json.Marshal(map[string]interface{}{"id": task.ID, "title": task.Title})
	return mcp.NewToolResultText(string(b)), nil
}

func (h *TaskHandlers) UpdateTask(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := topimcp.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("unauthorized"), nil
	}
	id, err := req.RequireString("id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	args := req.GetArguments()
	var title, listID, dueDate, priority, detail *string
	if _, ok := args["title"]; ok {
		v := req.GetString("title", "")
		title = &v
	}
	if _, ok := args["listId"]; ok {
		v := req.GetString("listId", "")
		listID = &v
	}
	if _, ok := args["dueDate"]; ok {
		v := req.GetString("dueDate", "")
		dueDate = &v
	}
	if _, ok := args["priority"]; ok {
		v := req.GetString("priority", "none")
		priority = &v
	}
	if _, ok := args["detail"]; ok {
		v := req.GetString("detail", "")
		detail = &v
	}
	if err := h.TaskSvc.Update(userID, id, title, listID, dueDate, priority, detail, time.UTC); err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText("task updated"), nil
}

func (h *TaskHandlers) ToggleTask(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := topimcp.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("unauthorized"), nil
	}
	id, err := req.RequireString("id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	if err := h.TaskSvc.Toggle(userID, id); err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText("task toggled"), nil
}

func (h *TaskHandlers) AbandonTask(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := topimcp.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("unauthorized"), nil
	}
	id, err := req.RequireString("id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	if err := h.TaskSvc.Abandon(userID, id); err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText("task abandoned"), nil
}

func (h *TaskHandlers) RestoreTask(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := topimcp.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("unauthorized"), nil
	}
	id, err := req.RequireString("id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	if err := h.TaskSvc.Restore(userID, id); err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText("task restored"), nil
}

func (h *TaskHandlers) MoveToTrash(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := topimcp.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("unauthorized"), nil
	}
	id, err := req.RequireString("id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	if err := h.TaskSvc.MoveToTrash(userID, id); err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText("task moved to trash"), nil
}

func (h *TaskHandlers) DeleteTask(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := topimcp.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("unauthorized"), nil
	}
	id, err := req.RequireString("id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	if err := h.TaskSvc.Delete(userID, id); err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText("task deleted"), nil
}

func (h *TaskHandlers) ReorderTasks(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := topimcp.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("unauthorized"), nil
	}
	id, err := req.RequireString("id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	newIndex := req.GetInt("newIndex", 0)
	if err := h.TaskSvc.Reorder(userID, id, newIndex); err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText("tasks reordered"), nil
}
