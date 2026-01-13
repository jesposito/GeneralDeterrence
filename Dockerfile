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

# Production stage - use slim (Debian-based) for glibc compatibility with @libsql/client
FROM node:20-slim

WORKDIR /app

# Copy server files and install dependencies
COPY server/package*.json ./
RUN npm install --omit=dev

COPY server/index.js ./

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Environment variables
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "index.js"]
