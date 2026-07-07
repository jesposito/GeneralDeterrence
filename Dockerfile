# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install server deps. better-sqlite3 compiles a native addon, which needs a C toolchain.
# Install it as a virtual package and remove it in the SAME layer so the toolchain never
# ships in the final image.
COPY server/package*.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
 && npm ci --omit=dev \
 && apk del .build-deps

# Server source
COPY server/index.js server/validate.js ./

# Built frontend from the builder stage
COPY --from=builder /app/dist ./dist

# Data dir for SQLite, owned by the unprivileged 'node' user we drop to below.
RUN mkdir -p /data && chown -R node:node /data /app

ENV PORT=3000
ENV DATA_DIR=/data

# Drop root — any RCE then runs as an unprivileged user.
USER node

EXPOSE 3000

# Health check — use 127.0.0.1 explicitly. `localhost` resolves to IPv6 ::1
# inside Alpine while node listens on IPv4, which causes spurious 'starting' /
# 'unhealthy' status even when the app is serving traffic.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "index.js"]
