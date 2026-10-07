import { createApp } from '../server/app.mjs';

const appOrigin = process.env.APP_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:4871');

const server = createApp({
  origin: appOrigin,
  env: {
    ...process.env,
    DATABASE_PATH: process.env.DATABASE_PATH || '/tmp/friday.sqlite',
    APP_ORIGIN: appOrigin,
  }
});

export default function handler(req, res) {
  server.emit('request', req, res);
}
