FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.9.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json apps/worker/
COPY packages/*/package.json packages/*/ 2>/dev/null || true
RUN pnpm fetch

FROM base AS build
COPY --from=deps /app /app
COPY . .
RUN pnpm -r install --offline
RUN pnpm -r build

FROM base AS prod
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/apps/worker/package.json ./apps/worker/package.json
CMD ["node","apps/worker/dist/index.js"]
