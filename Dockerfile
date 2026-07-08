# ========== Build Stage ==========
FROM node:24.15.0-alpine AS builder

WORKDIR /app

# 优先安装依赖，利用 Docker 缓存层
COPY package.json package-lock.json ./
RUN npm ci

# 复制源码并构建
COPY . .
RUN npm run build

# ========== Serve Stage ==========
FROM nginx:1.27-alpine

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA 路由 fallback 配置
RUN cat <<'EOF' > /etc/nginx/conf.d/default.conf
server {
    listen       80;
    listen  [::]:80;
    server_name  localhost;

    # gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;
    gzip_min_length 1024;

    location / {
        root   /usr/share/nginx/html;
        index  index.html;
        try_files $$uri $$uri/ /index.html;
    }

    # 静态资源长期缓存
    location /assets/ {
        root   /usr/share/nginx/html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# 确保 nginx 可读
RUN chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 80
