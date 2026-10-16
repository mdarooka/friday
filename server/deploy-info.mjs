/* Deploy identity for /api/health and the admin console.
   The image has no .git (see .dockerignore), so the SHA comes from a build-arg or the host. */

const SHA = /^[0-9a-f]{7,40}$/i;

export function commitSha(value) {
  const sha = String(value || '').trim().toLowerCase();
  return SHA.test(sha) ? sha : null;
}

export function buildTime(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function deployInfo(env = process.env) {
  const commit = commitSha(env.FRIDAY_COMMIT_SHA || env.VERCEL_GIT_COMMIT_SHA || env.GITHUB_SHA || env.SOURCE_VERSION);
  const builtAt = buildTime(env.FRIDAY_BUILD_TIME || env.VERCEL_GIT_COMMIT_TIMESTAMP);
  return { commit, builtAt };
}

/** True when the deployed SHA and main are the same commit, including a short prefix. */
export function sameCommit(deployed, main) {
  if (!deployed || !main) return null;
  return deployed === main || deployed.startsWith(main) || main.startsWith(deployed);
}

const MAIN_URL = 'https://api.github.com/repos/mdarooka/friday/commits/main';
let cached = { at: 0, sha: undefined };

/** Public main SHA, cached. A slow or failed lookup returns null and is not retried for ten minutes. */
export async function mainCommitSha({ fetchImpl = globalThis.fetch, now = Date.now(), timeoutMs = 1500, ttlMs = 10 * 60 * 1000 } = {}) {
  if (cached.sha !== undefined && now - cached.at < ttlMs) return cached.sha;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let sha = null;
  try {
    const res = await fetchImpl(MAIN_URL, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'friday-admin-status' },
      signal: ctrl.signal,
    });
    if (res.ok) {
      const body = await res.json();
      sha = commitSha(body && body.sha);
    }
  } catch {
    sha = null;
  } finally {
    clearTimeout(timer);
  }
  cached = { at: now, sha };
  return sha;
}

export function resetMainCommitCache() {
  cached = { at: 0, sha: undefined };
}
