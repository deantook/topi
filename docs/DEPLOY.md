# Topi 部署指南

## GitHub Actions 自动部署（Docker + 密码认证）

推送代码到 `main` 分支或手动触发后，流水线会在 GitHub 上构建镜像、导出为 tar、上传到服务器并加载运行，**服务器无需访问 GitHub/外网**。

### 1. 配置 GitHub Secrets

在仓库 **Settings → Secrets and variables → Actions** 中添加：

| Secret 名称 | 必填 | 说明 | 示例 |
|------------|------|------|------|
| `SERVER_HOST` | ✅ | 服务器 IP 或域名 | `192.168.1.100` |
| `SERVER_USER` | ✅ | SSH 登录用户名 | `deploy` |
| `SERVER_PASSWORD` | ✅ | SSH 登录密码 | `your-password` |
| `DEPLOY_PATH` | ✅ | 部署目录（需已创建） | `/var/www/topi` |
| `VITE_API_URL` | | 前端调用的 API 地址（构建时注入） | `http://your-server:8080` |

### 2. 服务器前置准备

在服务器上执行：

```bash
# 安装 Docker 与 Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 创建部署目录
sudo mkdir -p /var/www/topi
sudo chown $USER:$USER /var/www/topi

# 创建 API 环境变量文件（DB、JWT 等）
cat > /var/www/topi/.env << 'EOF'
DB_DSN=user:pass@tcp(mysql-host:3306)/topi?charset=utf8mb4&parseTime=True
JWT_SECRET=your-production-secret
JWT_EXPIRE_HOURS=168
GIN_MODE=release
CORS_ORIGIN=http://your-domain.com
EOF
```

### 3. 部署流程说明

1. GitHub Actions 构建 `topi-web`、`topi-api` 镜像  
2. 导出为 tar 并 gzip 压缩  
3. 通过 SCP 上传到服务器  
4. 服务器执行 `docker load` 加载镜像  
5. 执行 `docker compose up -d` 启动容器  

服务器只需能接受 SSH 连接，**不需访问 GitHub 或外网拉取镜像**。

### 4. 端口说明

- **3000**：前端（topi-web）
- **8080**：API（topi-api）

可在 `docker-compose.yml` 中调整对外映射端口。
