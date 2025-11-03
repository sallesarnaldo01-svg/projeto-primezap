FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.9.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./
COPY apps/worker/package.json apps/worker/
COPY packages ./packages
RUN apk add --no-cache python3 make g++ git
RUN pnpm fetch

FROM base AS build
COPY --from=deps /app /app
COPY . .
RUN apk add --no-cache python3 make g++ git
RUN pnpm -r install
# Generate Prisma Client at workspace root so runtime has generated client
RUN pnpm exec prisma generate --schema prisma/schema.prisma
RUN pnpm --filter @primeflow/shared --filter @primeflow/worker -r build

FROM base AS prod
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
# Include compiled shared workspace so "@primeflow/shared/*" imports resolve at runtime
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
# Include package-local node_modules in case pnpm used isolated linker
COPY --from=build /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/apps/worker/package.json ./apps/worker/package.json
CMD ["node","apps/worker/dist/index.js"]
