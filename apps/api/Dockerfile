FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.9.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./
COPY apps/api/package.json apps/api/
COPY packages ./packages
RUN apk add --no-cache python3 make g++ git
RUN pnpm fetch

FROM base AS build
COPY --from=deps /app /app
COPY . .
RUN apk add --no-cache python3 make g++ git
RUN pnpm -r install
# Build only shared and API to avoid worker build failures during API image compile
RUN pnpm --filter @primeflow/api exec prisma generate --schema prisma/schema.prisma
RUN pnpm --filter @primeflow/shared --filter @primeflow/api -r build

FROM base AS prod
ENV NODE_ENV=production
WORKDIR /app
# Copy entire workspace from build to preserve pnpm symlinks and all dependencies
COPY --from=build /app /app
EXPOSE 3000
# Use tsx loader to run source with ESM resolution that tolerates extensionless imports
CMD ["node","--import","tsx","apps/api/src/index.ts"]
