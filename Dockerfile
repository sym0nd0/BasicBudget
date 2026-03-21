FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build:frontend && npm run build:server

FROM node:20-alpine
WORKDIR /app
# su-exec is kept at runtime (needed by entrypoint); build tools are removed after npm ci
RUN apk add --no-cache python3 make g++ su-exec
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps && apk del python3 make g++
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/server/schema.sql ./server/schema.sql
COPY --from=build /app/dist ./public
RUN mkdir -p /app/data

# Non-root user — entrypoint fixes volume ownership then drops privileges via su-exec
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:${PORT:-3000}/api/auth/status || exit 1
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist-server/server/index.js"]
