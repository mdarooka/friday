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
        // Direct Deploy URL only. It is not a public site: pages on it redirect to APP_ORIGIN,
        // while /api stays reachable for health checks and the Vercel rewrite. Do not add
        // friday-travel-peach.vercel.app or other preview hosts here.
        APP_ORIGIN_ALIASES: "https://p-81-we-5b6199efcb56de4167-c098b2d7396b0066.deploy.built-with-hexclave.com",
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
        QUOTE_ADMIN_EMAILS: "manavdarooka1@gmail.com",
        AI_PROVIDER: "claude",
        AI_MODEL: "claude-sonnet-5-5",
        AI_DEEP_MODEL: "claude-sonnet-5-5",
        AI_EFFORT: "medium",
        // Empty defaults keep optional integrations off until their keys are supplied.
        ANTHROPIC_API_KEY: secret("ANTHROPIC_API_KEY", ""),
        PERPLEXITY_API_KEY: secret("PERPLEXITY_API_KEY", ""),
        GOOGLE_CLIENT_ID: secret("GOOGLE_CLIENT_ID", ""),
        GOOGLE_CLIENT_SECRET: secret("GOOGLE_CLIENT_SECRET", ""),
        GOOGLE_TOKEN_KEY: secret("GOOGLE_TOKEN_KEY", ""),
        GOOGLE_PLACES_API_KEY: secret("GOOGLE_PLACES_API_KEY", ""),
        OPENAI_API_KEY: secret("OPENAI_API_KEY", ""),
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
