export const config = {
  "apps": {
    "installed": {
      "authentication": {
        "enabled": true
      },
      "api-keys": {
        "enabled": true
      },
      "emails": {
        "enabled": true
      },
      "data-vault": {
        "enabled": true
      },
      "webhooks": {
        "enabled": true
      },
      "launch-checklist": {
        "enabled": true
      },
      "vercel": {
        "enabled": true
      },
      "analytics": {
        "enabled": true
      },
      "session-replays": {
        "enabled": true
      }
    }
  },
  "auth": {
    "password": {
      "allowSignIn": true
    },
    "otp": {
      "allowSignIn": false
    },
    "passkey": {
      "allowSignIn": false
    },
    "oauth": {
      "providers": {
        "google": {
          "type": "google",
          "allowSignIn": true,
          "allowConnectedAccounts": true
        },
        "microsoft": {
          "type": "microsoft",
          "allowSignIn": true,
          "allowConnectedAccounts": true
        }
      }
    }
  },
  "onboarding": {
    "requireEmailVerification": true
  },
  "emails": {
    "selectedThemeId": "1df07ae6-abf3-4a40-83a5-a1a2cbe336ac"
  }
};
