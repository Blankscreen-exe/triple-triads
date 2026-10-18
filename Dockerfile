# syntax=docker/dockerfile:1
#
# Production image for the Triple Triad server (Next.js + Socket.IO on one port).
#
#   docker build -t triple-triad .
#   docker run -p 3000:3000 -v triple-triad-data:/data triple-triad
#
# Behind a TLS-inspecting proxy or antivirus, pass its root certificate to the build steps that
# download packages (it is not stored in the image):
#
#   docker build --secret id=extra_ca,src=/path/to/root-ca.pem -t triple-triad .
#
# See docs/DEPLOYMENT.md for configuration and hosting.

ARG NODE_VERSION=24

# ---- Base: Node with pnpm (version taken from package.json "packageManager") -----------------
FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# `with-extra-ca <command>` trusts the optional extra_ca build secret for that command only.
RUN corepack enable \
 && printf '%s\n' '#!/bin/sh' \
      'if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi' \
      'exec "$@"' > /usr/local/bin/with-extra-ca \
 && chmod +x /usr/local/bin/with-extra-ca
WORKDIR /app

# ---- Manifests only, so dependency layers are cached until a manifest changes ---------------
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/engine/package.json packages/engine/
COPY packages/card-layout/package.json packages/card-layout/
RUN --mount=type=secret,id=extra_ca with-extra-ca corepack install

# Compilers for native modules, used only if a prebuilt binary is unavailable.
FROM manifests AS toolchain
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# ---- Build -----------------------------------------------------------------------------------
FROM toolchain AS build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store,sharing=locked --mount=type=secret,id=extra_ca \
    with-extra-ca pnpm install --frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @triple-triad/web build \
 && rm -rf apps/web/.next/cache

# ---- Production dependencies only ------------------------------------------------------------
FROM toolchain AS prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store,sharing=locked --mount=type=secret,id=extra_ca \
    with-extra-ca pnpm install --frozen-lockfile --prod --filter @triple-triad/web...

# ---- Runtime ---------------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/data
# Same layout as the repository: pnpm's node_modules are relative symlinks.
WORKDIR /app/apps/web

COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=prod-deps /app/apps/web/node_modules ./node_modules
COPY --from=build /app/apps/web/.next ./.next
COPY --from=build /app/apps/web/dist ./dist
COPY apps/web/package.json apps/web/next.config.ts ./
COPY apps/web/public ./public
COPY apps/web/drizzle ./drizzle

RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/healthz`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "--enable-source-maps", "dist/server.mjs"]
