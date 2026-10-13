# ─────────────────────────────────────────────────────────────────────────────
# Sonali Handlooms — production image.
#
# One process serves both the API and the built storefront, so this is the whole
# deployment: build the bundle, then run server/index.js.
#
#   docker build -t sonali-paithani .
#   docker run --rm -p 8080:8080 --env-file server/.env -e PORT=8080 sonali-paithani
#
# Works as-is on Fly.io, Railway, Render (Docker), DigitalOcean App Platform and
# any VPS. Put a TLS-terminating proxy (the platform, or Caddy/nginx) in front
# and set TRUST_PROXY=1 so the app sees real client IPs and https URLs.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine AS build
WORKDIR /app

# Vite and TypeScript are devDependencies on purpose, so the build stage has to
# ask for them explicitly — hosts that set NODE_ENV=production make npm skip
# them and the build dies with "vite: not found".
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
RUN npm run build

# ─── Runtime ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Server code and the built storefront. public/ is already baked into dist/.
COPY server ./server
COPY --from=build /app/dist ./dist

# Local-disk uploads (only used when Supabase Storage is not configured).
# Mount a volume here if you rely on it — container disk is wiped on redeploy.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads /app/dist

# Startup runs as the unprivileged user that ships with the node image.
USER node

EXPOSE 8080
CMD ["node", "server/index.js"]
