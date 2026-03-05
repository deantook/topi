# Topi 部署指南

## GitHub Actions 自动部署

推送代码到 `main` 分支或在 Actions 页手动触发后，流水线会自动构建并部署到指定服务器。

### 1. 配置 GitHub Secrets

在仓库 **Settings → Secrets and variables → Actions** 中添加：

| Secret 名称 | 说明 | 示例 |
|------------|------|------|
| `SERVER_HOST` | 服务器 IP 或域名 | `192.168.1.100` 或 `deploy.example.com` |
| `SERVER_USER` | SSH 登录用户名 | `deploy` |
| `SSH_PRIVATE_KEY` | SSH 私钥内容（完整，含头尾） | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `DEPLOY_PATH` | 服务器上的部署目录 | `/var/www/topi` |

### 2. 生成并配置 SSH 密钥

```bash
# 本地生成部署专用密钥
ssh-keygen -t ed25519 -C "github-deploy" -f deploy_key -N ""

# 将 deploy_key 内容复制到 SSH_PRIVATE_KEY
# 将 deploy_key.pub 内容追加到服务器的 ~/.ssh/authorized_keys
ssh-copy-id -i deploy_key.pub user@your-server
```

### 3. 服务器前置准备

- **Node.js 20+**
- **MySQL**（API 使用）
- 部署目录需提前创建且 `SERVER_USER` 有写权限：

```bash
sudo mkdir -p /var/www/topi
sudo chown $USER:$USER /var/www/topi
```

### 4. Systemd 服务配置（推荐）

在服务器上创建服务文件，用于托管前端和 API：

**API 服务** `/etc/systemd/system/topi-api.service`：

```ini
[Unit]
Description=Topi API Server
After=network.target mysql.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/var/www/topi
ExecStart=/var/www/topi/topi-api
Restart=on-failure
RestartSec=5
EnvironmentFile=/var/www/topi/api.env

[Install]
WantedBy=multi-user.target
```

**前端服务** `/etc/systemd/system/topi-web.service`：

```ini
[Unit]
Description=Topi Web (React Router)
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/var/www/topi
ExecStart=npm start
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

**API 环境变量** `/var/www/topi/api.env`：

```env
PORT=8080
DB_DSN=user:pass@tcp(localhost:3306)/topi?charset=utf8mb4&parseTime=True
JWT_SECRET=your-production-secret
JWT_EXPIRE_HOURS=168
GIN_MODE=release
CORS_ORIGIN=https://your-domain.com
```

启用并启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable topi-api topi-web
sudo systemctl start topi-api topi-web
```

### 5. 自定义部署路径

如需修改默认部署路径，在 GitHub Secrets 中设置 `DEPLOY_PATH`（如 `/home/deploy/apps/topi`）。

### 6. 无 systemd 时的重启方式

若未配置 systemd，流水线中的重启步骤会静默跳过。可改用 PM2 或在服务器上添加自定义重启脚本，并在 workflow 中调整 `Restart Services on Server` 步骤的 `script` 内容。
