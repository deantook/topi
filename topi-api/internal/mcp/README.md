# MCP Server (Topi)

`server.NewSSEServer(s)` 暴露 `SSEHandler()` 与 `MessageHandler()`，均返回 `http.Handler`，可挂载到 Gin 的 `*gin.Engine`（通过 `gin.Any("/mcp/sse", gin.WrapH(sseServer.SSEHandler()))` 等）或标准库 `*http.ServeMux`，无需备选方案。
