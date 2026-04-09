# Stage 1: Build dependencies
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

# Stage 2: Production image
FROM node:20-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY package.json ./
COPY src/ ./src/
COPY public/ ./public/

# Create uploads directory with proper permissions
RUN mkdir -p /app/public/images/uploads && chown -R appuser:appgroup /app

USER appuser

EXPOSE ${PORT:-5000}

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-5000}/ || exit 1

CMD ["node", "src/app.js"]
