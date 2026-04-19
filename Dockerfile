FROM node:24-alpine

RUN corepack enable

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

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "artifacts/api-server/dist/index.js"]