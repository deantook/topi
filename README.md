# Topi

待办任务管理应用，支持 Web 界面与 AI 集成。

- **Cursor MCP 集成**：在 Cursor 中创建、更新、列出任务
- **收件箱、今日/明天、自定义列表**：多视图任务管理
- **已完成/废弃**：历史任务回顾
- **富文本详情**：任务详情支持 Markdown
- **前后端分离**：可自托管部署

## 功能

- **收件箱**：未分配日期的任务统一入口
- **今日 / 明天**：按日期分组视图
- **自定义列表**：可创建多个列表管理不同任务
- **已完成 / 废弃**：历史任务回顾
- **富文本详情**：任务详情支持 Markdown（TipTap）
- **拖拽排序**：任务支持拖拽调整顺序

## 快速开始

**前置条件**：Go 1.25+、Node.js（pnpm）、MySQL；或仅 Docker

### 方式一：Docker 启动。

```bash
# 在项目根目录配置 .env（DB_DSN、JWT_SECRET 等，参考 docs/DEPLOY.md）
docker compose build
docker compose up -d
```

- 前端：http://localhost:3000
- API：http://localhost:8080

### 方式二：本地开发

**后端**：

```bash
cd topi-api
cp .env.example .env   # 编辑 .env，填入 DB_DSN 等
go run ./cmd/server
```

**前端**：

```bash
cd topi
pnpm install
pnpm run dev
```

或使用 Makefile：`make api`、`make web`（分终端启动），`make restart`（后台一并启动）

**访问**：

- 前端：http://localhost:5173（开发）
- API：http://localhost:8080
- Swagger：http://localhost:8080/swagger/index.html

## Cursor MCP 集成

Topi 通过 [MCP](https://modelcontextprotocol.io/) 暴露任务与列表工具，可在 Cursor 中直接创建、更新、列出任务。

**配置步骤**：

1. 启动 Topi 前端与 API，登录后进入 **设置** 页，在「MCP 令牌」区块生成令牌并复制
2. 在 Cursor MCP 配置中添加：

```json
{
  "mcpServers": {
    "topi": {
      "url": "http://localhost:8080/mcp/sse?token=YOUR_MCP_TOKEN"
    }
  }
}
```

将 `YOUR_MCP_TOKEN` 替换为设置页生成的 MCP 令牌。保存后重启 Cursor，并在 Settings → Tools & MCP 中启用 topi 服务器。

详见 [docs/MCP.md](docs/MCP.md)（远程部署、Header 认证、工具参数等）。

## 部署

生产环境采用 Docker + GitHub Actions 自动部署。详见 [docs/DEPLOY.md](docs/DEPLOY.md)。

## 项目结构

```
topi/       # 前端（React Router、Vite、shadcn/ui）
topi-api/   # 后端（Go、Gin、MySQL、Wire）
docs/       # 文档
```

**Makefile 常用命令**：`make swagger`、`make wire`、`make api`、`make web`、`make restart`、`make help`
