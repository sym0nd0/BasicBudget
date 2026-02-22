FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:frontend && npm run build:server

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev && apk del python3 make g++
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/server/schema.sql ./server/schema.sql
COPY --from=build /app/dist ./public
RUN mkdir -p /app/data
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
CMD ["node", "dist-server/server/index.js"]
