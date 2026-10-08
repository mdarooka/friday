import type { HexclaveDeploymentConfig } from "@hexclave/js";

export const deploymentGroupId = "friday";

export const deploy: HexclaveDeploymentConfig = ({ secret, service, hexclave }) => ({
  services: {
    web: {
      type: "server",
      public: true,
      minInstances: 0,
      ports: { 3000: { protocol: "http" } },
      dockerfilePath: "Dockerfile",
      devCommand: "node server/app.mjs",
      env: {
        NODE_ENV: "production",
        HOST: "0.0.0.0",
        PORT: "3000",
        APP_ORIGIN: "https://fridaytravel.vercel.app",
        // Keep Friday out of search by default; switch to "on" when public indexing is wanted.
        SEARCH_INDEXING: "off",
        // Direct Deploy URL only. It is not a public site: everything on it redirects to APP_ORIGIN
        // except /api/health (platform health check) and requests signed by the Vercel proxy. Do not add
        // friday-travel-peach.vercel.app or other preview hosts here.
        APP_ORIGIN_ALIASES: "https://p-81-we-5b6199efcb56de4167-c098b2d7396b0066.deploy.built-with-hexclave.com",
        HEXCLAVE_INTERNAL_HOST: "hxc-p-81-we-5b6199efcb56de4167.fly.dev",
        // SHA-256 of the FRIDAY_PROXY_SECRET env var on the Vercel project. vercel.json sends that
        // value as x-friday-proxy, so only proxied requests are served; direct Deploy-URL visits
        // redirect to APP_ORIGIN. Rotate both together: new Vercel value, then this hash.
        FRIDAY_PROXY_SECRET_SHA256: "f983604548c15cd8df6a51f46c8fa378c8adc14670f3d404343b11be653de490",
        // All application data lives in the private `database` service below; the web service keeps nothing on its own disk.
        DATABASE_HOST: service("database").hostname(),
        DATABASE_PORT: "5432",
        DATABASE_USER: "friday",
        DATABASE_NAME: "friday",
        DATABASE_PASSWORD: secret("POSTGRES_PASSWORD"),
        AUTH_REQUIRED: "true",
        AUTH_PROVIDER: "hexclave",
        TRUST_PROXY: "1",
        HEXCLAVE_PROJECT_ID: hexclave.projectId,
        HEXCLAVE_SECRET_SERVER_KEY: hexclave.secretServerKey,
        FRIDAY_ENQUIRY_EMAIL: "manavdarooka1@gmail.com",
        FRIDAY_WHATSAPP_NUMBER: secret("FRIDAY_WHATSAPP_NUMBER", ""),
        QUOTE_ADMIN_EMAILS: "manavdarooka1@gmail.com",
        AI_PROVIDER: "openai",
        AI_MODEL: "gpt-5-mini",
        OPENAI_RESEARCH_MODEL: "gpt-5-mini",
        // Empty defaults keep optional integrations off until their keys are supplied.
        GOOGLE_CLIENT_ID: secret("GOOGLE_CLIENT_ID", ""),
        GOOGLE_CLIENT_SECRET: secret("GOOGLE_CLIENT_SECRET", ""),
        GOOGLE_TOKEN_KEY: secret("GOOGLE_TOKEN_KEY", ""),
        GOOGLE_PLACES_API_KEY: secret("GOOGLE_PLACES_API_KEY", ""),
        OPENAI_API_KEY: secret("OPENAI_API_KEY", ""),
        FRIDAY_BRIEFING_AUTOSEND: "dry-run",
        FRIDAY_CRON_SECRET: secret("FRIDAY_CRON_SECRET", ""),
        // Bearer secret for GET /api/cron/db-backup (the nightly GitHub Actions backup); empty keeps the route off.
        FRIDAY_BACKUP_SECRET: secret("FRIDAY_BACKUP_SECRET", ""),
      },
    },
    // Private PostgreSQL, reachable only from other services in this project (raw TCP). It scales to zero, so the web
    // service retries its first connection with a bounded backoff. The disk is one unreplicated volume: it is not a backup.
    // Set the POSTGRES_PASSWORD project secret (dashboard: Project Settings > Secrets) before the first deploy.
    database: {
      type: "server",
      ports: { 5432: { protocol: "tcp" } },
      rootDirectory: "./database",
      dockerfilePath: "Dockerfile",
      minInstances: 0,
      persistentVolumes: {
        pgdata: { path: "/data", sizeGb: 1 },
      },
      env: {
        POSTGRES_PASSWORD: secret("POSTGRES_PASSWORD"),
        POSTGRES_USER: "friday",
        POSTGRES_DB: "friday",
      },
    },
  },
});
