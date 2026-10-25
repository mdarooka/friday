#!/usr/bin/env node
/* Loud alert for a failed Friday workflow. Opens one GitHub issue per title
   (and comments on it the next time) and, when BACKUP_ALERT_WEBHOOK_URL or
   ALERT_WEBHOOK_URL is set, POSTs the same text there. A later successful run
   closes that issue.

   node scripts/workflow-alert.mjs --title "..." --detail "..."
   node scripts/workflow-alert.mjs --resolve --title "..." */
import { appendFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function writeSummary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n');
  else console.log(markdown);
}

export function runUrl({ server = 'https://github.com', repo, runId } = {}) {
  if (!repo || !runId) return '';
  return `${String(server).replace(/\/$/, '')}/${repo}/actions/runs/${runId}`;
}

export function alertBody({ detail, run }) {
  const lines = [String(detail || 'The job failed.').trim()];
  if (run) lines.push('', `Run: ${run}`);
  return lines.join('\n');
}

async function github(request, { method = 'GET', token, path: apiPath, body }) {
  const res = await request(`https://api.github.com${apiPath}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'friday-workflow-alert',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text.slice(0, 200) }; }
  if (res.status >= 400) {
    const reason = data?.message || `HTTP ${res.status}`;
    const error = new Error(res.status === 403
      ? `GitHub refused the issue (${reason}). Under Settings → Actions → General → Workflow permissions, allow read and write, or set BACKUP_ALERT_WEBHOOK_URL.`
      : `GitHub issue request failed (${res.status}): ${reason}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

export async function findOpenIssue({ request, repo, token, title }) {
  const issues = await github(request, { repo, token, path: `/repos/${repo}/issues?state=open&per_page=100` });
  return (Array.isArray(issues) ? issues : []).find(issue => issue.title === title && !issue.pull_request) || null;
}

async function postWebhook(request, webhookUrl, text) {
  let url;
  try { url = new URL(webhookUrl); } catch { throw new Error('ALERT_WEBHOOK_URL is not a URL.'); }
  if (url.protocol !== 'https:') throw new Error('ALERT_WEBHOOK_URL must be https.');
  const res = await request(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, content: text })
  });
  if (!res.ok) throw new Error(`The alert webhook returned HTTP ${res.status}.`);
}

/* Returns { notified, issueUrl, warnings }. `notified` is true when an issue or the webhook was reached. */
export async function notifyFailure({ title, detail, run, repo, token, webhookUrl, request }) {
  const warnings = [];
  let issueUrl = '';
  const body = alertBody({ detail, run });
  if (token && repo) {
    try {
      const existing = await findOpenIssue({ request, repo, token, title });
      if (existing) {
        await github(request, { method: 'POST', repo, token, path: `/repos/${repo}/issues/${existing.number}/comments`, body: { body } });
        issueUrl = existing.html_url;
      } else {
        const created = await github(request, { method: 'POST', repo, token, path: `/repos/${repo}/issues`, body: { title, body } });
        issueUrl = created.html_url || '';
      }
    } catch (error) {
      warnings.push(error.message);
    }
  } else warnings.push('No GitHub token is available, so no issue was opened.');
  let webhookOk = false;
  if (webhookUrl) {
    try {
      await postWebhook(request, webhookUrl, `${title}\n\n${body}`.slice(0, 3500));
      webhookOk = true;
    } catch (error) {
      warnings.push(error.message);
    }
  }
  return { notified: Boolean(issueUrl) || webhookOk, issueUrl, warnings };
}

export async function resolveAlert({ title, run, repo, token, request }) {
  if (!token || !repo) return { closed: false, warnings: ['No GitHub token is available, so the alert issue was left as it is.'] };
  try {
    const existing = await findOpenIssue({ request, repo, token, title });
    if (!existing) return { closed: false, warnings: [] };
    const body = alertBody({ detail: 'This run succeeded, so this alert is closed.', run });
    await github(request, { method: 'POST', repo, token, path: `/repos/${repo}/issues/${existing.number}/comments`, body: { body } });
    await github(request, { method: 'PATCH', repo, token, path: `/repos/${repo}/issues/${existing.number}`, body: { state: 'closed', state_reason: 'completed' } });
    return { closed: true, issueUrl: existing.html_url, warnings: [] };
  } catch (error) {
    return { closed: false, warnings: [error.message] };
  }
}

async function main() {
  const { values } = parseArgs({ options: { title: { type: 'string' }, detail: { type: 'string' }, resolve: { type: 'boolean', default: false } } });
  if (!values.title) {
    console.error('::error::workflow-alert needs --title.');
    process.exitCode = 1;
    return;
  }
  const repo = process.env.GITHUB_REPOSITORY || '';
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
  const run = runUrl({ server: process.env.GITHUB_SERVER_URL, repo, runId: process.env.GITHUB_RUN_ID });
  const webhookUrl = process.env.ALERT_WEBHOOK_URL || process.env.BACKUP_ALERT_WEBHOOK_URL || '';
  if (values.resolve) {
    const result = await resolveAlert({ title: values.title, run, repo, token, request: fetch });
    for (const warning of result.warnings) console.error(warning);
    writeSummary(result.closed ? `### Alert\n\nClosed ${result.issueUrl}` : '### Alert\n\nNo open failure issue to close.');
    return;
  }
  const result = await notifyFailure({ title: values.title, detail: values.detail || '', run, repo, token, webhookUrl, request: fetch });
  for (const warning of result.warnings) console.error(`::warning::${warning}`);
  if (!result.notified) {
    const message = result.warnings.join(' ') || 'The failure was not sent anywhere.';
    console.error(`::error::${message}`);
    writeSummary(`### Alert\n\nFAILED: ${message}`);
    process.exitCode = 1;
    return;
  }
  const where = [result.issueUrl ? `GitHub issue ${result.issueUrl}` : '', webhookUrl ? 'the alert webhook' : ''].filter(Boolean).join(' and ');
  writeSummary(`### Alert\n\nSent to ${where}.`);
  console.log(`Alert sent to ${where}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(`::error::${error?.message || error}`);
    process.exit(1);
  });
}
