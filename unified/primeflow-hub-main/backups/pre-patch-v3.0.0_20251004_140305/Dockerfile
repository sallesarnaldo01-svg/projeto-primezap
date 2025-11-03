# Stage 1: build
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache git python3 make g++
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --legacy-peer-deps; else npm i --legacy-peer-deps; fi
COPY . .
RUN npm run build

# Stage 2: Nginx
FROM nginx:1.25-alpine
COPY nginx/primezap.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ > /dev/null || exit 1
