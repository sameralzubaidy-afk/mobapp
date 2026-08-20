// Hermes CDP console capture for the bulk phone-gate verify tap (QA evidence, run-local).
// Connects to Metro's inspector WebSocket and streams console/log/exception events to a file.
const WebSocket = require('/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/node_modules/ws');
const fs = require('fs');

const WS_URL = process.argv[2] || 'ws://localhost:8081/inspector/debug?device=2051df57f308b7f8f20ee9c2fcb953eb404443b8&page=1';
const OUT = process.argv[3] || '/tmp/cdp-console.log';
const DURATION_MS = parseInt(process.argv[4] || '40000', 10);

const ws = new WebSocket(WS_URL, { maxPayload: 100 * 1024 * 1024 });
const started = Date.now();
let enabled = false;

function line(s) {
  fs.appendFileSync(OUT, `[${new Date().toISOString()}] ${s}\n`);
}

ws.on('open', () => {
  line('CDP CONNECTED');
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Log.enable' }));
  ws.send(JSON.stringify({ id: 3, method: 'Console.enable' }));
  enabled = true;
});

function extractValue(remoteObj) {
  if (!remoteObj) return '';
  if (remoteObj.value !== undefined) return String(remoteObj.value);
  if (remoteObj.description !== undefined) return String(remoteObj.description);
  if (remoteObj.unserializableValue !== undefined) return String(remoteObj.unserializableValue);
  return JSON.stringify(remoteObj);
}

ws.on('message', (data) => {
  let msg;
  try { msg = JSON.parse(data.toString()); } catch { return; }
  const m = msg.method || '';
  const p = msg.params || {};
  if (m === 'Runtime.consoleAPICalled') {
    const args = (p.args || []).map(extractValue).join(' ');
    line(`[console.${p.type}] ${args}`);
  } else if (m === 'Log.entryAdded') {
    line(`[log.${p.entry?.level}] ${p.entry?.text || ''}`);
  } else if (m === 'Runtime.exceptionThrown') {
    const d = p.exceptionDetails || {};
    line(`[exception] ${d.text || ''} ${d.exception?.description || ''}`);
  } else if (m === 'Runtime.consoleAPICalled' === false) {
    // noop
  }
});

// keep alive for the duration then exit
const timer = setInterval(() => {
  if (Date.now() - started > DURATION_MS) {
    line('CDP CAPTURE END');
    clearInterval(timer);
    try { ws.close(); } catch {}
    process.exit(0);
  }
}, 1000);

setTimeout(() => {
  line('CDP TIMEOUT EXIT');
  try { ws.close(); } catch {}
  process.exit(0);
}, DURATION_MS + 5000);
