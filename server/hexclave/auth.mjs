import { HexclaveServerApp } from '@hexclave/js';

/**
 * Hexclave is the source of truth for browser authentication. The Friday API
 * verifies the SDK token on each request; no long-lived Friday session can
 * outlive a revoked, expired, or restricted Hexclave session.
 */
export function createHexclaveAuth({ env = process.env, serverApp, log = () => {} } = {}) {
  const projectId = String(env.HEXCLAVE_PROJECT_ID || '').trim();
  const secretServerKey = String(env.HEXCLAVE_SECRET_SERVER_KEY || '').trim();
  const validProjectId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId);
  const configured = Boolean(validProjectId && secretServerKey);
  const app = serverApp || (configured
    ? new HexclaveServerApp({ projectId, secretServerKey, tokenStore: null })
    : null);

  return {
    configured,
    projectId: configured ? projectId : null,
    async currentUser(req) {
      if (!app) return null;
      try {
        const user = await app.getUser({ tokenStore: req, includeRestricted: true });
        if (!user || user.isAnonymous) return null;
        return {
          id: user.id,
          email: user.primaryEmail || '',
          name: user.displayName || user.primaryEmail || 'Friday traveller',
          emailVerified: Boolean(user.primaryEmailVerified),
          restricted: Boolean(user.isRestricted),
          restrictedReason: user.restrictedReason?.type || null,
        };
      } catch (error) {
        // Invalid, expired, or revoked credentials all behave as signed out.
        log(`Hexclave rejected a session: ${String(error?.message || error).slice(0, 250)}`);
        return null;
      }
    },
    async deleteUser(userId) {
      if (!app || typeof app.getUser !== 'function') throw new Error('Hexclave account deletion is not available on this server.');
      const target = await app.getUser(userId);
      if (!target) return { alreadyDeleted: true };
      if (target.id !== userId || typeof target.delete !== 'function') throw new Error('Hexclave did not return a deletable account.');
      await target.delete();
      return { deleted: true };
    },
  };
}
