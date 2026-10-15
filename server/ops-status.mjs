import { deployInfo, mainCommitSha, sameCommit } from './deploy-info.mjs';
import * as store from './store.mjs';

function job(row, extra = {}) {
  if (!row || !row.finished) return null;
  return { finished: row.finished, mode: row.mode || null, ...extra };
}

/** Last successful sweep for each scheduled job, plus the deployed commit compared with main when that lookup is cheap. */
export async function opsStatus(db, { env = process.env, compareMain = true, fetchImpl } = {}) {
  const deploy = deployInfo(env);
  let main = null;
  if (compareMain) {
    main = await mainCommitSha({ fetchImpl });
  }
  const [backup, briefings, quoteDigest, guideDigest] = await Promise.all([
    store.lastGoodBackupRun(db),
    store.lastGoodBriefingRun(db),
    store.lastGoodQuoteDigestRun(db),
    store.lastGoodGuideDigestRun(db),
  ]);
  return {
    deploy: {
      commit: deploy.commit,
      builtAt: deploy.builtAt,
      main,
      matchesMain: sameCommit(deploy.commit, main),
    },
    jobs: {
      backup: backup ? { finished: backup.finished, mode: 'backup' } : null,
      briefings: job(briefings),
      quoteDigest: job(quoteDigest, { outcome: quoteDigest?.outcome || null }),
      guideDigest: job(guideDigest, { outcome: guideDigest?.outcome || null }),
    },
  };
}
