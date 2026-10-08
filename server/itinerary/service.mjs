/* Picks the configured itinerary provider and adds the safety net: any failure falls back to the local one.
   This is separate from AI_PROVIDER (Claude / Perplexity research in server/ai.mjs). */
import { createLocalProvider } from './providers/local.mjs';
import { createOpenAIProvider } from './providers/openai.mjs';
import { createAuth } from './providers/openai-auth.mjs';
import { buildPrompt, validateDrafts } from './providers/openai.mjs';
import { generator } from './catalog.mjs';

const intEnv = (v, fallback) => { const n = Number(v); return v !== undefined && v !== '' && Number.isFinite(n) ? n : fallback; };

/**
 * createItineraryService({ env, fetch, log, knowledge }) ->
 *   { name, generate(dest, request) -> { provider, plan, fallbackReason? } }
 * `name` is the provider in use: ITINERARY_PROVIDER, else openai when a credential is configured, else local.
 * Throws on an invalid ITINERARY_PROVIDER or OPENAI_AUTH.
 */
export function createItineraryService({ env = process.env, fetch: fetchImpl, log = () => {}, knowledge } = {}) {
  const requested = (env.ITINERARY_PROVIDER || '').toLowerCase();
  if (requested && requested !== 'local' && requested !== 'openai') {
    throw new Error('ITINERARY_PROVIDER must be "local" or "openai" (got "' + requested + '")');
  }
  const local = createLocalProvider();
  const auth = createAuth(env);
  const configured = auth.getAuth();
  const name = requested || (configured ? 'openai' : 'local');
  const primary = name === 'openai'
    ? createOpenAIProvider({ auth, model: env.OPENAI_MODEL || 'gpt-5-mini', timeoutMs: intEnv(env.OPENAI_TIMEOUT_MS, 30000), fetch: fetchImpl, knowledge })
    : local;
  const scrub = auth.redact ? (t) => auth.redact(t) : (t) => String(t);

  return {
    name,
    /* The prompt a browser-side model call needs: the same builder (and house knowledge) the openai provider uses. */
    prompt(dest, request) {
      const { system, user } = buildPrompt(dest, request, knowledge);
      return { instructions: system, input: user };
    },
    /* A plan from a draft the user's own ChatGPT produced in their browser. It goes through the same catalog
       validation as the openai provider; an unusable draft falls back to the configured server provider. */
    async fromDraft(dest, request, draft) {
      if (dest.freeform) throw Object.assign(new Error('A ChatGPT draft can only be validated for a catalog destination.'), { status: 422 });
      try {
        const { stops } = buildPrompt(dest, request, null);
        const drafts = validateDrafts(dest, draft, request, stops);
        return { provider: 'chatgpt', plan: generator.assemble(dest, drafts, { dates: request.dates, base: request.base }) };
      } catch (err) {
        const reason = 'ChatGPT draft unusable: ' + scrub((err && err.message) || 'unknown error').slice(0, 250);
        const out = await this.generate(dest, request);
        return { ...out, fallbackReason: reason + (out.fallbackReason ? '; ' + out.fallbackReason : '') };
      }
    },
    async generate(dest, request) {
      if (dest.freeform) {
        // A place outside the catalog has no local fallback: only the OpenAI provider can plan it (Friday plans anywhere).
        if (name !== 'openai') throw Object.assign(new Error('Planning a place outside Friday\u2019s guides needs the OpenAI itinerary provider, which is not configured.'), { status: 503 });
        try { return { provider: primary.name, plan: await primary.generate(dest, request) }; } catch (err) {
          throw Object.assign(new Error('The plan for ' + dest.name + ' could not be made: ' + scrub((err && err.message) || 'unknown error').slice(0, 200)), { status: 502 });
        }
      }
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
