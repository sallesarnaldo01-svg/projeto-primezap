FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.9.0 --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN apk add --no-cache python3 make g++ git && pnpm fetch --filter ./apps/web...

COPY . .
RUN apk add --no-cache python3 make g++ git \
  && pnpm install

# Build and serve production preview
RUN if [ -d dist ]; then echo "Using existing dist/ (skipping build)"; else pnpm build; fi
EXPOSE 8080
CMD ["pnpm","preview","--host","0.0.0.0","--port","8080"]
