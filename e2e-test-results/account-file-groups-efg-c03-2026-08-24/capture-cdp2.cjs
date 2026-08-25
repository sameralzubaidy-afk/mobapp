// Hermes CDP console capture v2 — reconnects after the app reload triggered by debugger attach.
// CommonJS. Polls the Metro /json endpoint, re-resolves the target, and reconnects if the socket
// drops. Writes captured lines to a file in the run's evidence folder.
'use strict';
const fs = require('fs');
const http = require('http');

const OUT = process.argv[2] || '/tmp/qa-cdp-capture2.txt';
const DURATION_MS = Number(process.argv[3] || 60000);
const METRO_JSON = 'http://localhost:8081/json';
const WS = require('/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/node_modules/ws');

let socket = null;
const out = [];
const ts = () => new Date().toISOString();
const started = Date.now();

function fetchJson(url) {
  return new Promise((resolve, reject) => {
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

async function resolveTarget() {
  try {
    const targets = await fetchJson(METRO_JSON);
    return (
      targets.find((t) => t.webSocketDebuggerUrl && String(t.title).length > 0 && t.type === 'node') ||
      targets[0]
    );
  } catch {
    return null;
  }
}

function attach(target) {
  if (socket) {
    try {
      socket.close();
    } catch {}
  }
  socket = new WS(target.webSocketDebuggerUrl);
  socket.on('open', () => {
    out.push(`[${ts()}] attached to ${target.webSocketDebuggerUrl}`);
    socket.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
    socket.send(JSON.stringify({ id: 2, method: 'Log.enable' }));
    socket.send(JSON.stringify({ id: 3, method: 'Console.enable' }));
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
      out.push(`[${ts()}] EXCEPTION: ${d.exception?.description || d.text || ''}`);
    }
  });
  socket.on('error', (e) => {
    out.push(`[${ts()}] socket error: ${e.message}`);
  });
  socket.on('close', () => {
    out.push(`[${ts()}] socket closed`);
  });
}

async function main() {
  let target = await resolveTarget();
  if (target && target.webSocketDebuggerUrl) {
    attach(target);
  } else {
    out.push(`[${ts()}] no target at start`);
  }

  while (Date.now() - started < DURATION_MS) {
    await new Promise((r) => setTimeout(r, 4000));
    // If the socket is dead or no target, re-resolve and reconnect.
    const dead = !socket || socket.readyState !== WS.OPEN;
    const t = await resolveTarget();
    if (dead && t && t.webSocketDebuggerUrl) {
      attach(t);
    }
  }

  fs.writeFileSync(OUT, out.join('\n'));
  console.error('[capture] wrote ' + out.length + ' lines to ' + OUT);
  try {
    socket && socket.close();
  } catch {}
  process.exit(0);
}

main().catch((e) => {
  console.error('capture error:', e);
  process.exit(1);
});
