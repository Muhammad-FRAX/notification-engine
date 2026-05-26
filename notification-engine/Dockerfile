# Stage 1 — build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package*.json frontend/
RUN cd frontend && npm ci
COPY frontend/ frontend/
RUN cd frontend && npm run build

# Stage 2 — install backend production dependencies
# argon2 requires native compilation on Alpine (musl libc has no prebuilds)
FROM node:20-alpine AS backend-deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY backend/package*.json backend/
RUN cd backend && npm ci --omit=dev

# Stage 3 — lean runtime image
FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=backend-deps /app/backend/node_modules backend/node_modules
COPY backend/ backend/
COPY --from=frontend-builder /build/frontend/dist frontend/dist
COPY docker-entrypoint.sh backend/docker-entrypoint.sh
# Strip CRLF if checked out on Windows, then make executable
RUN sed -i 's/\r$//' backend/docker-entrypoint.sh && chmod +x backend/docker-entrypoint.sh
WORKDIR /app/backend
EXPOSE 5000
ENTRYPOINT ["./docker-entrypoint.sh"]
