#!/usr/bin/env node
/*
  Check Amplitude events via Amplitude's Export API
  Usage:
  AMPLITUDE_EXPORT_API_KEY=xxx AMPLITUDE_EXPORT_API_SECRET=yyy node scripts/check-amplitude-events.js --event dev_analytics_test --start 2025-12-11T00:00:00 --end 2025-12-12T00:00:00
*/
const fetch = require('node-fetch');
const argv = require('yargs').argv;

const key = process.env.AMPLITUDE_EXPORT_API_KEY;
const secret = process.env.AMPLITUDE_EXPORT_API_SECRET;

if (!key || !secret) {
  console.error('AMPLITUDE_EXPORT_API_KEY and AMPLITUDE_EXPORT_API_SECRET must be set');
  process.exit(1);
}

async function run() {
  const eventName = argv.event || 'dev_analytics_test';
  const start = argv.start || argv.s || new Date(Date.now() - 3600 * 24 * 1000).toISOString();
  const end = argv.end || argv.e || new Date().toISOString();

  const url = `https://amplitude.com/api/2/export?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  console.log('Querying Amplitude export API. This may take a moment...');
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) {
    console.error('Amplitude export API responded', res.status, await res.text());
    process.exit(2);
  }
  // Response is gzipped exported events; for test purposes we'll just check http status
  console.log('Export requested. Please download and inspect to find your event.');
  console.log('For automated verification, consider setting up a project pipeline and use Amplitude Query API.');
}

run().catch((err) => {
  console.error(err);
  process.exit(3);
});
