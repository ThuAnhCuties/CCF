# Stage 1: Cài đặt dependencies (tận dụng cache tốt hơn)
FROM docker.io/node:26-alpine AS deps
WORKDIR /app

# Copy riêng các file quản lý package để cài đặt trước
COPY package.json package-lock.json* ./

# Cài đặt production dependencies (không devDependencies)
RUN npm ci --only=production --ignore-scripts

# Stage 2: Production image (tinh gọn)
FROM docker.io/node:26-alpine AS production
WORKDIR /app

# Kiểm tra phiên bản Node (đảm bảo >= 26)
RUN node -e "const v=process.versions.node.split('.')[0]; if(v<26) { console.error('ERROR: Node >= 26 required, got '+v); process.exit(1); }"

# Cài timezone data nếu cần
RUN apk add --no-cache tzdata

# Tạo user không root để chạy ứng dụng
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Copy node_modules từ stage deps
COPY --from=deps /app/node_modules ./node_modules

# Copy toàn bộ source code (đã được lọc qua .dockerignore)
COPY . .

# Đảm bảo quyền sở hữu cho user không root
RUN chown -R appuser:appgroup /app

# Chuyển sang user không root
USER appuser

# Đảm bảo entrypoint có quyền thực thi (nếu cần)
RUN chmod +x /app/docker-entrypoint.sh 2>/dev/null || true

# Expose port nếu ứng dụng có listen (tùy chọn)
# EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
