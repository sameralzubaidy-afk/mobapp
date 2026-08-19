// QA evidence — Hermes CDP console capture (playbook §5.12)
// Streams Runtime.consoleAPICalled / Log.entryAdded / exceptionThrown from the
// Metro inspector target to a capture file. Passive streaming only.
// Usage: node cdp-capture.mjs <outFile> [durationMs]
const { default: WebSocket } = await import('ws');
import { writeFileSync, appendFileSync } from 'fs';

const outFile = process.argv[2] || './cdp-console.log';
const durationMs = Number(process.argv[3]) || 240000;

const lines = [];
const log = (line) => {
  lines.push(line);
  try { appendFileSync(outFile, line + '\n'); } catch {}
};

async function resolveTarget() {
  const res = await fetch('http://localhost:8081/json');
  const targets = await res.json();
  return targets.find((t) => (t.type === 'node' || t.title.includes('React')) && t.webSocketDebuggerUrl);
}

function attach(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.on('open', () => resolve(ws));
    ws.on('error', (e) => reject(e));
  });
}

let ws = null;
async function connect() {
  const t = await resolveTarget();
  if (!t) return null;
  ws = await attach(t.webSocketDebuggerUrl);
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const m = msg.method;
    if (m === 'Runtime.consoleAPICalled') {
      const p = msg.params;
      const text = (p.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
      log(`[${new Date().toISOString()}] CONSOLE.${p.type}: ${text}`);
    } else if (m === 'Log.entryAdded') {
      const e = msg.params.entry;
      log(`[${new Date().toISOString()}] LOG.${e.level}: ${e.text}`);
    } else if (m === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      log(`[${new Date().toISOString()}] EXCEPTION: ${d?.text} ${d?.exception?.description ?? ''}`);
    }
  });
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Log.enable' }));
  ws.send(JSON.stringify({ id: 3, method: 'Console.enable' }));
  return ws;
}

console.log('CDP capture started ->', outFile);
let conn = await connect();
if (!conn) {
  console.log('WARN: no inspector target found yet (app may not be connected to Metro)');
}
const timer = setInterval(async () => {
  if (!ws || ws.readyState !== 1) {
    console.log('CDP: reconnecting...');
    try { conn = await connect(); } catch (e) { console.log('CDP reconnect err', e.message); }
  }
}, 10000);

setTimeout(() => {
  clearInterval(timer);
  try { ws?.close(); } catch {}
  console.log('CDP capture finished. Lines:', lines.length);
  process.exit(0);
}, durationMs);
