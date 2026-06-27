# syntax=docker/dockerfile:1
# Container image for the Lantern event-planning app (Next.js + Prisma).
# Portable to any container host (Azure Container Apps, App Service, etc.).
#
# The runtime image keeps the full dependency tree on purpose: `prisma migrate
# deploy` needs the Prisma CLI and pdfkit needs its bundled font data. We favour
# reliability over a slimmer standalone image; revisit if image size matters.

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma query engine needs OpenSSL.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# ---- dependencies ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM base AS build
ENV NODE_ENV=production
# Public env vars are compiled into the client bundle at build time.
ARG NEXT_PUBLIC_CURRENCY=EUR
ENV NEXT_PUBLIC_CURRENCY=$NEXT_PUBLIC_CURRENCY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ---- runtime ----
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# node_modules from build includes the generated Prisma client + the CLI.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/next.config.mjs /app/package.json /app/package-lock.json ./
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && chown -R nextjs:nodejs /app
USER nextjs
EXPOSE 3000
# Apply DB migrations once (init container / release), then serve:
#   migrate: npx prisma migrate deploy
#   serve:   npm run start
CMD ["npm", "run", "start"]
