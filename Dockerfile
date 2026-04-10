FROM node:20-alpine
RUN corepack enable

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app
COPY . .
ENV CI=true
RUN pnpm install --no-frozen-lockfile

# Build shared db package first
WORKDIR /app/lib/db
RUN pnpm build

# Build frontend
WORKDIR /app/artifacts/jhsc-tracker
RUN pnpm run build

# Build backend
WORKDIR /app/artifacts/api-server
RUN rm -rf dist
RUN pnpm run build

WORKDIR /app

# Switch to non-root user
RUN chown -R appuser:appgroup /app
USER appuser

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "artifacts/api-server/dist/index.js"]
