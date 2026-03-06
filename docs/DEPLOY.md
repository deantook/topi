# Topi 部署指南

## GitHub Actions 自动部署（Docker + Nginx HTTPS）

推送代码到 `main` 分支或手动触发后，流水线会在 GitHub 上构建镜像、导出为 tar、上传到服务器并加载运行，**服务器无需访问 GitHub/外网**。

Nginx 作为反向代理，提供 HTTPS。当前启用 **\*.lulumia.fun**；添加 `pem/www.lulumia.com.*` 后可启用 www.lulumia.com（见 `deploy/servers/lulumia.com.conf.disabled`）。

### 1. 配置 GitHub Secrets

在仓库 **Settings → Secrets and variables → Actions** 中添加：

| Secret 名称 | 必填 | 说明 | 示例 |
|------------|------|------|------|
| `SERVER_HOST` | ✅ | 服务器 IP 或域名 | `192.168.1.100` |
| `SERVER_USER` | ✅ | SSH 登录用户名 | `deploy` |
| `SERVER_PASSWORD` | ✅ | SSH 登录密码 | `your-password` |
| `DEPLOY_PATH` | ✅ | 部署目录（需已创建） | `/var/www/topi` |
| `VITE_API_URL` | | 前端调用的 API 地址（构建时注入，默认 `https://www.lulumia.fun`） | `https://www.lulumia.fun` |

### 2. 证书（pem/）

部署需 SSL 证书，将证书放入 `pem/` 目录：

| 域名 | 证书文件 | 密钥文件 | 状态 |
|------|----------|----------|------|
| \*.lulumia.fun | `pem/_.lulumia.fun.pem` | `pem/_.lulumia.fun.key` | 已启用 |
| www.lulumia.com | `pem/www.lulumia.com.pem` | `pem/www.lulumia.com.key` | 需添加证书后启用 `deploy/servers/lulumia.com.conf.disabled` → `.conf` |

证书需提交到仓库或通过其他方式在首次部署前放入服务器 `$DEPLOY_PATH/pem/`。

### 3. 服务器前置准备

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
CORS_ORIGIN=https://www.lulumia.fun
EOF
```

### 4. 部署流程说明

1. GitHub Actions 构建 `topi-web`、`topi-api` 镜像  
2. 导出为 tar 并 gzip 压缩  
3. 通过 SCP 上传到服务器（含 `docker-compose.yml`、`deploy/nginx.conf`、`pem/`）  
4. 服务器执行 `docker load` 加载镜像  
5. 执行 `docker compose up -d` 启动容器  

服务器只需能接受 SSH 连接，**不需访问 GitHub 或外网拉取镜像**。

### 5. 端口说明

- **80**：HTTP（重定向到 HTTPS）
- **443**：HTTPS（Nginx 反向代理）
- 3000、8080：内部服务，不对外暴露
