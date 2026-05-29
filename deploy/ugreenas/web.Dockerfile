FROM node:22-bookworm-slim AS builder

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY web/package*.json ./web/
COPY prisma ./prisma
WORKDIR /app/web
RUN npm ci

COPY web ./
RUN npx prisma generate --schema ../prisma/schema.prisma --generator web

ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://arbiter:arbiter@postgres:5432/arbiter?schema=public
ENV BETTER_AUTH_SECRET=build-only-secret-do-not-use-in-production-1234567890
ENV BETTER_AUTH_URL=http://localhost:3000
ENV DISCORD_CLIENT_ID=build-only
ENV DISCORD_CLIENT_SECRET=build-only
ARG NEXT_PUBLIC_GA_ID=
ARG NEXT_PUBLIC_SITE_URL=https://arbiter.moonbot.info
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

WORKDIR /app/web
ARG NEXT_PUBLIC_GA_ID=
ARG NEXT_PUBLIC_SITE_URL=https://arbiter.moonbot.info
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/web/package*.json ./
COPY --from=builder /app/web/node_modules ./node_modules
COPY --from=builder /app/web/.next ./.next
COPY --from=builder /app/web/public ./public
COPY --from=builder /app/web/next.config.ts ./next.config.ts
COPY --from=builder /app/web/lib/generated ./lib/generated

CMD ["npm", "run", "start"]
