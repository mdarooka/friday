/*
 * Where the OpenAI provider gets its credentials. The provider never reads the environment itself; it
 * asks a credential source:
 *
 *   getAuth() -> { baseUrl, headers } | null      (may return a promise)
 *
 * `null` means "not configured", and the itinerary service then uses the local provider. One source
 * ships: `api-key` (OPENAI_API_KEY), chosen by OPENAI_AUTH (default `api-key`).
 *
 * A "Sign in with ChatGPT" token source can implement this same interface later: return the same
 * shape with a refreshed bearer token in `headers`, and register it in SOURCES below. No sign-in
 * flow exists here.
 */
export const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export function apiKeySource(env) {
  const key = (env.OPENAI_API_KEY || '').trim();
  const baseUrl = (env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  return {
    name: 'api-key',
    getAuth() {
      if (!key) return null;
      return { baseUrl, headers: { Authorization: 'Bearer ' + key } };
    },
    /** Remove the secret from text that may be logged or returned. */
    redact(text) { return key ? String(text).split(key).join('[redacted]') : String(text); }
  };
}

const SOURCES = { 'api-key': apiKeySource };

export function createAuth(env = process.env) {
  const name = (env.OPENAI_AUTH || 'api-key').toLowerCase();
  if (!SOURCES[name]) throw new Error('OPENAI_AUTH must be one of: ' + Object.keys(SOURCES).join(', ') + ' (got "' + name + '")');
  return SOURCES[name](env);
}
