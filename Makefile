.PHONY: swagger wire api web restart help

# 默认目标
help:
	@echo "Topi Makefile 常用命令:"
	@echo "  make swagger  - 重新生成 Swagger 文档 (topi-api)"
	@echo "  make wire     - 重新生成 Wire 依赖注入代码 (topi-api)"
	@echo "  make api      - 启动后端 API 服务 (:8080)"
	@echo "  make web      - 启动前端开发服务 (:5173)"
	@echo "  make restart  - 重启前后端服务"

# 生成 Swagger 文档
swagger:
	@cd topi-api && swag init -g cmd/server/main.go -o docs
	@echo "Swagger docs generated in topi-api/docs/"

# 生成 Wire 依赖注入代码
wire:
	@cd topi-api && go generate ./internal/wire/...
	@echo "Wire code generated"

# 启动后端 API
api:
	@cd topi-api && go run ./cmd/server

# 启动前端开发服务
web:
	@cd topi && pnpm run dev

# 重启前后端: 先停止占用端口的进程，再后台启动
restart: stop
	@echo "Starting API on :8080..."
	@cd topi-api && nohup go run ./cmd/server > /tmp/topi-api.log 2>&1 & echo $$! > /tmp/topi-api.pid
	@sleep 2
	@echo "Starting Web on :5173..."
	@cd topi && nohup pnpm run dev > /tmp/topi-web.log 2>&1 & echo $$! > /tmp/topi-web.pid
	@echo "Services started. API: http://localhost:8080, Web: http://localhost:5173"
	@echo "Logs: /tmp/topi-api.log, /tmp/topi-web.log"

# 停止前后端服务 (按端口)
stop:
	@echo "Stopping services..."
	@-lsof -ti:8080 | xargs kill 2>/dev/null || true
	@-lsof -ti:5173 | xargs kill 2>/dev/null || true
	@echo "Stopped"
