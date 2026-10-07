import type { HexclaveDeploymentConfig } from "@hexclave/js";

export const deploymentGroupId = "friday";

export const deploy: HexclaveDeploymentConfig = ({ secret, hexclave }) => ({
  services: {
    web: {
      type: "server",
      public: true,
      minInstances: 0,
      ports: { 3000: { protocol: "http" } },
      dockerfilePath: "Dockerfile",
      devCommand: "node server/app.mjs",
      persistentVolumes: {
        friday_data: { path: "/data", sizeGb: 1 },
      },
      env: {
        NODE_ENV: "production",
        HOST: "0.0.0.0",
        PORT: "3000",
        APP_ORIGIN: "https://fridaytravel.vercel.app",
        DATABASE_PATH: "/data/app/friday.sqlite",
        DATABASE_BACKUP_DIR: "/data/backups",
        DATABASE_BACKUP_INTERVAL_SECONDS: "86400",
        DATABASE_BACKUP_RETENTION_COUNT: "7",
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
  },
});
