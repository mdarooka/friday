FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    APP_ORIGIN=https://p-81-we-5b6199efcb56de4167-c098b2d7396b0066.deploy.built-with-hexclave.com \
    DATABASE_PATH=/app/.data/friday.sqlite

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .
RUN npm run build \
    && mkdir -p /app/.data /app/backups /data \
    && chown -R node:node /app /data

USER node
EXPOSE 3000 4871
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/app.mjs"]
