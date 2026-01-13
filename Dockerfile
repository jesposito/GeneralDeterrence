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

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy server files and install dependencies
COPY server/package*.json ./
RUN npm install --omit=dev

COPY server/index.js ./

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Create data directory for SQLite
RUN mkdir -p /data

# Environment variables
ENV PORT=3000
ENV DATA_DIR=/data

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "index.js"]
