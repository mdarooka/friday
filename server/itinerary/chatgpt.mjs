/*
 * "Sign in with ChatGPT" (SIWC) configuration. PUBLIC values only.
 *
 * Under OpenAI's terms the user's access and refresh tokens live in the user's own browser and are never sent to, or
 * stored by, this server. The server therefore only (a) tells the browser how to start the OAuth flow, (b) builds the
 * prompt the browser sends to OpenAI, and (c) validates the draft the browser sends back. A client id is public by
 * design (PKCE public client); there is no client secret anywhere in this app.
 */
const clean = (v, fallback) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);

export function chatgptConfig(env = process.env, origin = 'http://localhost:4871') {
  const clientId = clean(env.SIWC_CLIENT_ID, '');
  let redirectPath = clean(env.SIWC_REDIRECT_PATH, '/chatgpt-callback.html');
  if (!redirectPath.startsWith('/')) redirectPath = '/' + redirectPath;
  return {
    enabled: !!clientId,
    clientId,
    issuer: clean(env.SIWC_ISSUER, 'https://auth.openai.com').replace(/\/+$/, ''),
    scopes: clean(env.SIWC_SCOPES, 'openid profile email offline_access'),
    model: clean(env.SIWC_MODEL, 'gpt-5-mini'),
    redirectUri: new URL(redirectPath, origin).href
  };
}

/** The block exposed in /api/capabilities. Nothing is revealed unless a client id is configured. */
export function publicChatgpt(cfg) {
  if (!cfg.enabled) return { enabled: false };
  const { enabled, clientId, issuer, scopes, model, redirectUri } = cfg;
  return { enabled, clientId, issuer, scopes, model, redirectUri };
}
