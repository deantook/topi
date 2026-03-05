package handlers

import (
	"context"
	"encoding/json"

	topimcp "github.com/deantook/topi-api/internal/mcp"
	"github.com/deantook/topi-api/internal/service"
	"github.com/mark3labs/mcp-go/mcp"
)

type ListHandlers struct {
	ListSvc *service.ListService
}

func NewListHandlers(listSvc *service.ListService) *ListHandlers {
	return &ListHandlers{ListSvc: listSvc}
}

func (h *ListHandlers) ListLists(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := topimcp.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("unauthorized"), nil
	}
	lists, err := h.ListSvc.List(userID)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	out := make([]map[string]interface{}, 0, len(lists))
	for _, l := range lists {
		out = append(out, map[string]interface{}{
			"id":   l.ID,
			"name": l.Name,
		})
	}
	b, _ := json.Marshal(out)
	return mcp.NewToolResultText(string(b)), nil
}

func (h *ListHandlers) CreateList(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := topimcp.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("unauthorized"), nil
	}
	name, err := req.RequireString("name")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	list, err := h.ListSvc.Create(userID, name)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	b, _ := json.Marshal(map[string]interface{}{"id": list.ID, "name": list.Name})
	return mcp.NewToolResultText(string(b)), nil
}

func (h *ListHandlers) UpdateList(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := topimcp.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("unauthorized"), nil
	}
	id, err := req.RequireString("id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	name, err := req.RequireString("name")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	if err := h.ListSvc.Update(userID, id, name); err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText("list updated"), nil
}

func (h *ListHandlers) DeleteList(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := topimcp.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("unauthorized"), nil
	}
	id, err := req.RequireString("id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	if err := h.ListSvc.Delete(userID, id); err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText("list deleted"), nil
}
