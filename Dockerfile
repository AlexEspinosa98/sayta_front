# ============================================================
# Dockerfile - Sayta Frontend (React + Vite + pnpm, multi-stage)
# Stage 1: Build con Node.js + pnpm
# Stage 2: Produccion con nginx:1.27-alpine
# ============================================================

# --- Stage 1: Build ---
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml .npmrc ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

# --- Stage 2: Produccion ---
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD wget -O /dev/null http://127.0.0.1/ && echo ok || exit 1

CMD ["nginx", "-g", "daemon off;"]
