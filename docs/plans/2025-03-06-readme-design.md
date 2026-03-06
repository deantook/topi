# Topi README 重写设计

## 设计背景

- **受众**：开发者与普通用户兼顾
- **语言**：中文
- **MCP**：作为核心亮点单独呈现

## 第一节：开头与核心亮点

- 标题：`# Topi`
- 一句话：待办任务管理应用，支持 Web 界面与 AI 集成
- 核心亮点（简要 bullet）：
  - Cursor MCP 集成：在 Cursor 中创建、更新、列出任务
  - 收件箱、今日/明天、自定义列表、已完成/废弃视图
  - 任务详情支持 Markdown 富文本
  - 前后端分离，可自托管部署

## 第二节：功能概览

`## 功能`

- 收件箱：未分配日期的任务统一入口
- 今日 / 明天：按日期分组视图
- 自定义列表：可创建多个列表管理不同任务
- 已完成 / 废弃：历史任务回顾
- 富文本详情：任务详情支持 Markdown（TipTap）
- 拖拽排序：任务支持拖拽调整顺序

## 第三节：快速开始

**前置条件**：Go 1.25+、Node.js（pnpm）、MySQL；或仅 Docker

**方式一：Docker 一键启动**
- 配置 `.env`（DB_DSN、JWT_SECRET 等），参考 docs/DEPLOY.md
- `docker compose up -d`
- 前端 :3000，API :8080

**方式二：本地开发**
- 后端：`cd topi-api && cp .env.example .env`，编辑后 `go run ./cmd/server`
- 前端：`cd topi && pnpm install && pnpm run dev`
- 或 Makefile：`make api`、`make web`、`make restart`

**访问**：前端 http://localhost:5173（开发）/ :3000（Docker），API http://localhost:8080，Swagger `/swagger/index.html`

## 第四节：MCP 与 Cursor

`## Cursor MCP 集成`

- 说明：通过 MCP 暴露任务与列表工具，可在 Cursor 中创建、更新、列出任务
- SSE 传输，URL：`http://localhost:8080/mcp/sse?token=YOUR_JWT`
- JWT：登录 → 开发者工具 → Local Storage → `token`
- 配置示例（mcpServers.topi.url）
- 详情见 [docs/MCP.md](../MCP.md)

## 第五节：部署、项目结构、贡献

**部署**：Docker + GitHub Actions，详见 [docs/DEPLOY.md](../DEPLOY.md)

**项目结构**：
- `topi/`：前端（React Router、Vite、shadcn/ui）
- `topi-api/`：后端（Go、Gin、MySQL、Wire）
- `docs/`：文档

**Makefile**：`make swagger`、`make wire`、`make api`、`make web`、`make restart`

**贡献**：极简或省略
