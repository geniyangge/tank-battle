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

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
