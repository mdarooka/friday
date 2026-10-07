import type { HexclaveDeploymentConfig } from "@hexclave/js";

export const deploymentGroupId = "friday";

export const deploy: HexclaveDeploymentConfig = () => ({
  services: {
    web: {
      type: "server",
      public: true,
      ports: { 3000: { protocol: "http" } },
      minInstances: 0,
      dockerfilePath: "Dockerfile",
      devCommand: "node server/app.mjs",
      env: {
        NODE_ENV: "production",
        APP_ORIGIN: "https://p-81-we-5b6199efcb56de4167-c098b2d7396b0066.deploy.built-with-hexclave.com",
        AUTH_REQUIRED: "true",
        AUTH_PROVIDER: "hexclave",
        FRIDAY_ENQUIRY_EMAIL: "manavdarooka1@gmail.com",
        QUOTE_ADMIN_EMAILS: "manavdarooka1@gmail.com",
        AI_PROVIDER: "claude",
        AI_MODEL: "claude-sonnet-5-5",
        AI_DEEP_MODEL: "claude-sonnet-5-5",
        AI_EFFORT: "medium",
      },
    },
  },
});
