// Hermes CDP console capture for the C03 unlink-error investigation (QA evidence, read-only).
// Streams Runtime.consoleAPICalled / Log.entryAdded / Runtime.exceptionThrown from the
// Metro Hermes inspector and writes captured lines to a file in the run's evidence folder.
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || '/tmp/qa-cdp-capture.txt';
const DURATION_MS = Number(process.argv[3] || 45000);
const METRO_JSON = 'http://localhost:8081/json';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    http
      .get(url, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

async function main() {
  const targets = await fetchJson(METRO_JSON);
  // RN app target = the "node"-type debugger entry with a webSocketDebuggerUrl.
  const target = targets.find((t) => t.webSocketDebuggerUrl && String(t.title).length > 0 && t.type === 'node') || targets[0];
  if (!target || !target.webSocketDebuggerUrl) {
    console.error('no inspector target found');
    process.exit(1);
  }
  const ws = require('/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/node_modules/ws');
  const socket = new ws(target.webSocketDebuggerUrl);
  const out = [];
  const ts = () => new Date().toISOString();

  socket.on('open', () => {
    socket.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
    socket.send(JSON.stringify({ id: 2, method: 'Log.enable' }));
    socket.send(JSON.stringify({ id: 3, method: 'Console.enable' }));
    console.error('[capture] attached to inspector; capturing for ' + DURATION_MS + 'ms');
  });

  socket.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const m = msg.method;
    if (m === 'Runtime.consoleAPICalled') {
      const type = msg.params.type;
      const args = (msg.params.args || [])
        .map((a) => a.value ?? a.description ?? a.unserializableValue ?? '')
        .join(' ');
      out.push(`[${ts()}] console.${type}: ${args}`);
    } else if (m === 'Log.entryAdded') {
      const e = msg.params.entry;
      out.push(`[${ts()}] log.${e.level}: ${e.text}`);
    } else if (m === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      const text = d.exception?.description || d.text || '';
      out.push(`[${ts()}] EXCEPTION: ${text}`);
    }
  });

  socket.on('error', (e) => {
    out.push(`[${ts()}] socket error: ${e.message}`);
  });

  await new Promise((r) => setTimeout(r, DURATION_MS));
  fs.writeFileSync(OUT, out.join('\n'));
  console.error('[capture] wrote ' + out.length + ' lines to ' + OUT);
  socket.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('capture error:', e);
  process.exit(1);
});
