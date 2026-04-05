FROM node:20-alpine

RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --no-frozen-lockfile

# Build API
WORKDIR /app/artifacts/api-server
RUN pnpm run build

# IMPORTANT: run from correct working directory
WORKDIR /app/artifacts/api-server

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]