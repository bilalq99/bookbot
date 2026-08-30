# Chalk API + web app, single container. SQLite + uploads live under /data —
# mount a persistent volume there.
#
#   docker build -t chalk .
#   docker run -p 3000:3000 -v chalk-data:/data chalk
#
# Put TLS in front (a reverse proxy or your platform's edge) before exposing it.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.server.json vite.config.ts ./
COPY src ./src
# VITE_API_BASE stays empty: the container serves the web app same-origin.
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/chalk.db \
    UPLOADS_DIR=/data/uploads
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "dist/server/index.js"]
