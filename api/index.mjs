import { createApp } from '../server/app.mjs';

const appOrigin = process.env.APP_ORIGIN || process.env.PUBLIC_SITE_ORIGIN || (process.env.NODE_ENV === 'production' ? 'https://fridaytravel.vercel.app' : 'http://localhost:4871');

const server = createApp({
  origin: appOrigin,
  env: {
    ...process.env,
    DATABASE_PATH: process.env.DATABASE_PATH || '/tmp/friday.sqlite',
    ...(appOrigin ? { APP_ORIGIN: appOrigin } : {}),
  }
});

export default function handler(req, res) {
  server.emit('request', req, res);
}
