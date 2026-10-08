/* Picks the configured itinerary provider and adds the safety net: any failure falls back to the local one.
   This is separate from the research chat in server/ai.mjs, though both use the Claude API (Anthropic). */
import { createLocalProvider } from './providers/local.mjs';
import { createClaudeProvider } from './providers/claude.mjs';

const intEnv = (v, fallback) => { const n = Number(v); return v !== undefined && v !== '' && Number.isFinite(n) ? n : fallback; };

/**
 * createItineraryService({ env, fetch, log, knowledge }) ->
 *   { name, generate(dest, request) -> { provider, plan, fallbackReason? } }
 * `name` is the provider in use: ITINERARY_PROVIDER, else claude when ANTHROPIC_API_KEY is set, else local.
 * Throws on an invalid ITINERARY_PROVIDER.
 */
export function createItineraryService({ env = process.env, fetch: fetchImpl, log = () => {}, knowledge } = {}) {
  const requested = (env.ITINERARY_PROVIDER || '').toLowerCase();
  if (requested && requested !== 'local' && requested !== 'claude') {
    throw new Error('ITINERARY_PROVIDER must be "local" or "claude" (got "' + requested + '")');
  }
  const local = createLocalProvider();
  const apiKey = (env.ANTHROPIC_API_KEY || '').trim();
  const name = requested || (apiKey ? 'claude' : 'local');
  const primary = name === 'claude'
    ? createClaudeProvider({ apiKey, model: env.ITINERARY_MODEL || env.AI_MODEL || 'claude-sonnet-5-5', timeoutMs: intEnv(env.ITINERARY_TIMEOUT_MS, 30000), fetch: fetchImpl, knowledge })
    : local;
  const scrub = (t) => (apiKey ? String(t).split(apiKey).join('[redacted]') : String(t));

  return {
    name,
    async generate(dest, request) {
      try {
        const plan = await primary.generate(dest, request);
        return { provider: primary.name, plan };
      } catch (err) {
        const reason = scrub((err && err.message) || 'unknown error').slice(0, 300);
        log('provider ' + primary.name + ' failed, using local: ' + reason);
        const plan = await local.generate(dest, request);
        return { provider: 'local', plan, fallbackReason: reason };
      }
    }
  };
}
