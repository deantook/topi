# Topi

待办任务管理应用，支持 Web 界面与 **Cursor AI 对话管理**：在聊天里自然说「记下来」「今天有什么任务」，AI 会帮你创建、查看、完成任务。

## 用 Cursor 对话管理任务

Topi 通过 [MCP](https://modelcontextprotocol.io/) 把任务能力暴露给 Cursor。在 Cursor 里配置好 MCP 后，直接用自然语言和 AI 说需求，AI 会调用 Topi 的接口完成操作。

### 配置 MCP（首次使用）

1. 启动 Topi 前端与 API，登录后进入 **设置** 页
2. 在「MCP 令牌」区块点击「生成令牌」，复制令牌
3. 打开 Cursor 的 MCP 配置（Settings → Features → MCP → Open Configuration File），添加：

```json
{
  "mcpServers": {
    "topi": {
      "url": "http://localhost:8080/mcp/sse?token=YOUR_MCP_TOKEN"
    }
  }
}
```

将 `YOUR_MCP_TOKEN` 替换为你的令牌。保存后重启 Cursor，并在 Settings → Tools & MCP 中启用 **topi** 服务器。

### 使用 Skills（自然语言触发）

在 Cursor 聊天中，可以用下面这些说法来管理任务，AI 会自动识别并调用对应能力：

| 你想做的事 | 可以这样说 |
|------------|------------|
| **添加任务** | 记下来、加到待办、帮我记一下、把 X 列入计划、提醒我 X |
| **批量添加** | 把这几项都加上、这些都记下来 |
| **查看任务** | 今天有什么任务、明天要做什么、收件箱里有什么、看看我的待办、本周任务 |
| **完成任务** | 完成这个、标记为已完成、打勾 |
| **修改任务** | 改下标题、移到明天、换个日期、设个优先级、设个预估耗时 |
| **删除/恢复** | 放弃、删掉、从回收站捞回来 |
| **管理列表** | 创建新列表、我有哪些列表、把这个加到 X 列表 |

**带预估耗时的任务**：可以说「把这三件事记下来，各 2 小时、1 小时、3 小时」，AI 会创建任务并设置预估时间，方便做时间规划。

### 工作原理

- 你说的「记下来」「今天有什么任务」等会被 Cursor 的 **topi-mcp-tasks** Skill 识别
- Skill 指导 AI 调用 Topi 的 MCP 工具（如 `topi_create_task`、`topi_list_tasks`）
- 任务数据与 Web 界面同步，在浏览器里也能查看和编辑

---

## Web 界面功能

- **收件箱**：未分配日期的任务统一入口
- **今日 / 明天**：按日期分组
- **自定义列表**：创建多列表分类管理
- **已完成 / 废弃**：历史回顾
- **富文本详情**：任务详情支持 Markdown
- **拖拽排序**：任务可拖拽调整顺序

---

## 快速开始

**方式一：Docker（推荐）**

```bash
# 配置 .env（DB_DSN、JWT_SECRET 等，参考 docs/DEPLOY.md）
docker compose build
docker compose up -d
```

- 前端：http://localhost:3000
- API：http://localhost:8080

**方式二：本地开发**

后端：`cd topi-api && cp .env.example .env`，编辑后 `go run ./cmd/server`  
前端：`cd topi && pnpm install && pnpm run dev`

---

## 进一步了解

- **MCP 配置**：远程部署、Header 认证、故障排查 → [topi-api/docs/MCP.md](topi-api/docs/MCP.md)
- **部署**：生产环境 Docker + GitHub Actions → [docs/DEPLOY.md](docs/DEPLOY.md)
- **项目结构**：`topi/` 前端（React、Vite、shadcn/ui）、`topi-api/` 后端（Go、Gin、MySQL）
