FROM node:24-bookworm-slim

# Optional. Hexclave does not pass these unless the image build is given them.
# docker build --build-arg FRIDAY_COMMIT_SHA=$(git rev-parse HEAD) --build-arg FRIDAY_BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) .
ARG FRIDAY_COMMIT_SHA=
ARG FRIDAY_BUILD_TIME=
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    APP_ORIGIN=https://fridaytravel.vercel.app \
    FRIDAY_COMMIT_SHA=${FRIDAY_COMMIT_SHA} \
    FRIDAY_BUILD_TIME=${FRIDAY_BUILD_TIME}

# PostgreSQL 17 client (bookworm ships 15, which cannot dump a 17 server) for the nightly backup endpoint.
# The pgdg script reads HOST as its mirror host, so override the app's HOST=0.0.0.0 for that one command.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates postgresql-common \
    && HOST=apt.postgresql.org /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y \
    && apt-get install -y --no-install-recommends postgresql-client-17 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .
RUN npm run build \
    && chown -R node:node /app

USER node
EXPOSE 3000 4871
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/app.mjs"]
