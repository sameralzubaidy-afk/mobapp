const fetch = require('node-fetch');

async function purgeCdnFiles(zoneId, apiToken, urls) {
  if (!zoneId || !apiToken) throw new Error('zoneId and apiToken are required');
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ files: urls }),
  });
  const data = await res.json();
  return data;
}

module.exports = { purgeCdnFiles };
