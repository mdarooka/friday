/* Shared secret check for the external cron routes. A missing or short secret
   makes the route answer 404, so an unconfigured endpoint is indistinguishable
   from one that was never deployed. Callers send the secret twice: Vercel's
   proxy has been known to drop Authorization on the way to Hexclave, and it
   forwards X-Friday-Cron-Secret. */

export const CRON_SECRET_HEADER = 'x-friday-cron-secret';
export const MIN_CRON_SECRET_LENGTH = 32;

export function presentedCronSecret(headers = {}) {
  const custom = headerValue(headers, CRON_SECRET_HEADER).trim();
  if (custom) return custom;
  return /^Bearer (.+)$/.exec(headerValue(headers, 'authorization'))?.[1] || '';
}

function headerValue(headers, name) {
  const value = headers[name] ?? headers[name.toLowerCase()] ?? '';
  return Array.isArray(value) ? String(value[0] ?? '') : String(value);
}
