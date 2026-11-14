# syntax=docker/dockerfile:1
#
# FULL-STACK image used by Render (and any single-origin deploy):
#   admin console (admin-web/dist)  +  API  +  WebSocket gateway  → one origin.
#
# Build from the REPOSITORY ROOT (context must contain backend/ and admin-web/):
#   docker build -t free-fire-fullstack .
#   docker run -p 5000:5000 --env-file backend/.env free-fire-fullstack
#
# The API-only image for the VPS/Caddy stack stays at backend/Dockerfile.

# ─── Stage 1: build the admin console ───────────────────────────────────
FROM node:22-alpine AS admin-builder
WORKDIR /app/admin-web

COPY admin-web/package*.json ./
RUN npm ci --ignore-scripts

COPY admin-web/ ./
# `npm run build` = tsc --noEmit && vite build → /app/admin-web/dist
RUN npm run build

# ─── Stage 2: build the backend ─────────────────────────────────────────
FROM node:22-alpine AS backend-builder
WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --ignore-scripts

COPY backend/prisma.config.ts backend/tsconfig.json ./
COPY backend/prisma ./prisma

# Prisma generate only needs a syntactically valid URL at build time.
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
RUN npm run prisma:generate

COPY backend/src ./src
RUN npm run build

# ─── Stage 3: runtime ───────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=5000 \
    SERVE_ADMIN_WEB=true \
    ADMIN_WEB_DIST=/app/admin-web/dist

# curl backs the container healthcheck.
RUN apk add --no-cache curl

COPY backend/package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=backend-builder --chown=node:node /app/dist ./dist
COPY --from=backend-builder --chown=node:node /app/prisma.config.ts ./prisma.config.ts

# Static mock-checkout page + bundled admin console.
COPY --chown=node:node backend/public ./public
COPY --from=admin-builder --chown=node:node /app/admin-web/dist ./admin-web/dist

USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}/health" || exit 1

CMD ["node", "dist/server.js"]
