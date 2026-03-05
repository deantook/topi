package mcpsetup

import (
	"net/http"

	"github.com/deantook/topi-api/internal/mcp/handlers"
	"github.com/deantook/topi-api/pkg/jwt"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// MCPServer wraps the MCP SSE server and its HTTP handlers for mounting on Gin.
type MCPServer struct {
	sseServer *server.SSEServer
}

// SSEHandler returns an http.Handler for the SSE endpoint (GET /mcp/sse).
func (m *MCPServer) SSEHandler() http.Handler {
	return m.sseServer.SSEHandler()
}

// MessageHandler returns an http.Handler for the message endpoint (POST /mcp/message).
func (m *MCPServer) MessageHandler() http.Handler {
	return m.sseServer.MessageHandler()
}

// NewMCPServer creates and configures the MCP server with all Topi tools.
func NewMCPServer(taskH *handlers.TaskHandlers, listH *handlers.ListHandlers, _ *jwt.Helper) *MCPServer {
	s := server.NewMCPServer("Topi MCP", "1.0.0", server.WithToolCapabilities(true))

	// Task tools
	s.AddTool(
		mcp.NewTool("topi_list_tasks",
			mcp.WithDescription("List tasks with optional filters"),
			mcp.WithString("filter", mcp.DefaultString("all")),
			mcp.WithString("listId", mcp.Description("Filter by list ID")),
			mcp.WithString("date", mcp.Description("Date filter")),
			mcp.WithString("startDate", mcp.Description("Start date filter")),
			mcp.WithString("endDate", mcp.Description("End date filter")),
		),
		taskH.ListTasks,
	)
	s.AddTool(
		mcp.NewTool("topi_create_task",
			mcp.WithDescription("Create a new task"),
			mcp.WithString("title", mcp.Required()),
			mcp.WithString("listId", mcp.Description("Optional list ID")),
			mcp.WithString("dueDate", mcp.Description("Optional due date")),
			mcp.WithString("priority", mcp.DefaultString("none")),
		),
		taskH.CreateTask,
	)
	s.AddTool(
		mcp.NewTool("topi_create_tasks",
			mcp.WithDescription("Create multiple tasks at once"),
			mcp.WithString("tasks", mcp.Required(), mcp.Description("JSON array of {title, listId?, dueDate?, priority?}")),
		),
		taskH.CreateTasks,
	)
	s.AddTool(
		mcp.NewTool("topi_update_task",
			mcp.WithDescription("Update an existing task"),
			mcp.WithString("id", mcp.Required()),
			mcp.WithString("title", mcp.Description("New title")),
			mcp.WithString("listId", mcp.Description("New list ID")),
			mcp.WithString("dueDate", mcp.Description("New due date")),
			mcp.WithString("priority", mcp.Description("New priority")),
		),
		taskH.UpdateTask,
	)
	s.AddTool(
		mcp.NewTool("topi_toggle_task",
			mcp.WithDescription("Toggle task completion status"),
			mcp.WithString("id", mcp.Required()),
		),
		taskH.ToggleTask,
	)
	s.AddTool(
		mcp.NewTool("topi_abandon_task",
			mcp.WithDescription("Abandon a task"),
			mcp.WithString("id", mcp.Required()),
		),
		taskH.AbandonTask,
	)
	s.AddTool(
		mcp.NewTool("topi_restore_task",
			mcp.WithDescription("Restore an abandoned or trashed task"),
			mcp.WithString("id", mcp.Required()),
		),
		taskH.RestoreTask,
	)
	s.AddTool(
		mcp.NewTool("topi_trash_task",
			mcp.WithDescription("Move a task to trash"),
			mcp.WithString("id", mcp.Required()),
		),
		taskH.MoveToTrash,
	)
	s.AddTool(
		mcp.NewTool("topi_delete_task",
			mcp.WithDescription("Permanently delete a task"),
			mcp.WithString("id", mcp.Required()),
		),
		taskH.DeleteTask,
	)
	s.AddTool(
		mcp.NewTool("topi_reorder_tasks",
			mcp.WithDescription("Reorder tasks by moving a task to a new index"),
			mcp.WithString("id", mcp.Required()),
			mcp.WithNumber("newIndex", mcp.DefaultNumber(0)),
		),
		taskH.ReorderTasks,
	)

	// List tools
	s.AddTool(
		mcp.NewTool("topi_list_lists",
			mcp.WithDescription("List all task lists"),
		),
		listH.ListLists,
	)
	s.AddTool(
		mcp.NewTool("topi_create_list",
			mcp.WithDescription("Create a new list"),
			mcp.WithString("name", mcp.Required()),
		),
		listH.CreateList,
	)
	s.AddTool(
		mcp.NewTool("topi_update_list",
			mcp.WithDescription("Update a list"),
			mcp.WithString("id", mcp.Required()),
			mcp.WithString("name", mcp.Required()),
		),
		listH.UpdateList,
	)
	s.AddTool(
		mcp.NewTool("topi_delete_list",
			mcp.WithDescription("Delete a list"),
			mcp.WithString("id", mcp.Required()),
		),
		listH.DeleteList,
	)

	sseServer := server.NewSSEServer(s,
		server.WithStaticBasePath("/mcp"),
		server.WithSSEEndpoint("/sse"),
		server.WithMessageEndpoint("/message"),
	)

	return &MCPServer{sseServer: sseServer}
}
