FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.9.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./
COPY apps/api/package.json apps/api/
COPY packages ./packages
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
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
EXPOSE 3000
CMD ["node","apps/api/dist/index.js"]
