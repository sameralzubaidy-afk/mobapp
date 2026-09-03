// Bounded Hermes CDP console capture — QA Task 24 evidence
// Usage: node capture-cdp-msg.mjs <wsUrl> <seconds>
// Prints Runtime.consoleAPICalled + Runtime.exceptionThrown entries for the window.
import WebSocket from 'ws';

const wsUrl = process.argv[2];
const seconds = parseInt(process.argv[3] || '8', 10);

const ws = new WebSocket(wsUrl);
let buf = '';
const out = [];

ws.on('open', () => {
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Log.enable' }));
  ws.send(JSON.stringify({ id: 3, method: 'Console.enable' }));
  setTimeout(() => { ws.close(); }, seconds * 1000);
});

ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  const m = msg.method;
  if (m === 'Runtime.consoleAPICalled') {
    const p = msg.params;
    const args = (p.args || []).map((a) => a.value !== undefined ? a.value : (a.description || a.type)).join(' ');
    out.push(`[console.${p.type}] ${args}`);
  } else if (m === 'Runtime.exceptionThrown') {
    const ed = msg.params.exceptionDetails;
    out.push(`[exception] ${ed.text} ${ed.exception ? ed.exception.description : ''}`);
  } else if (m === 'Log.entryAdded') {
    out.push(`[log.${msg.params.entry.level}] ${msg.params.entry.text}`);
  }
});

ws.on('close', () => {
  process.stdout.write(out.join('\n') + '\n');
});
ws.on('error', (e) => { console.error('WS error', e.message); process.exit(1); });
