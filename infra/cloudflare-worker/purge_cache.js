#!/usr/bin/env node
'use strict';

const fetch = require('node-fetch');

const CF_ZONE_ID = process.env.CF_ZONE_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;

if (!CF_ZONE_ID || !CF_API_TOKEN) {
  console.error('Please set CF_ZONE_ID and CF_API_TOKEN env vars.');
  process.exit(1);
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: node purge_cache.js <url1> [url2 ...]');
  process.exit(1);
}

async function purge(urls) {
  const payload = { files: urls };
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CF_API_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  console.log('Purge response:', JSON.stringify(data, null, 2));
}

purge(args).catch((e) => {
  console.error(e);
  process.exit(1);
});
