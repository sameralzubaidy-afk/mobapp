/*
A lightweight Node script that uses @sentry/node to send a test event to Sentry.
Run this after setting EXPO_PUBLIC_SENTRY_DSN in .env.local.
*/
require('dotenv').config({ path: '.env.local' });
const Sentry = require('@sentry/node');

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
if (!DSN) {
  console.error('Missing EXPO_PUBLIC_SENTRY_DSN or SENTRY_DSN in environment.');
  process.exit(1);
}

console.log('Using DSN', DSN);
Sentry.init({ dsn: DSN, tracesSampleRate: Number(process.env.EXPO_PUBLIC_SENTRY_TRACES_RATE || 0.05), environment: process.env.EXPO_PUBLIC_ENVIRONMENT || 'development' });
Sentry.setTag('app', 'p2p-kids-marketplace');
Sentry.captureMessage('Test Sentry event (message) from mobile script', 'error');
Sentry.captureException(new Error('Test Sentry event (exception) from p2p-kids-marketplace/scripts/test-sentry-node.js'));
console.log('Sentry test events sent (mobile script)');
