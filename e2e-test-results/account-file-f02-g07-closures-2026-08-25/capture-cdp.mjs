// Hermes CDP console capture for the Account Groups A-G full closure batch (QA evidence, read-only).
// Streams Runtime.consoleAPICalled / Log.entryAdded / Runtime.exceptionThrown from the Metro Hermes
// inspector and writes captured lines to a file. Reconnects (re-resolving the target) if the socket
// drops, e.g. across an app relaunch. Run until killed.
'use strict';
import fs from 'node:fs';
import http from 'node:http';

const OUT = process.argv[2] || '/tmp/qa-cdp-capture.txt';
const METRO_JSON = 'http://localhost:8081/json';

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

const WS_PATH = '/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/node_modules/ws/index.js';
const { default: WS } = await import(WS_PATH);

const ts = () => new Date().toISOString();
const log = (line) => {
  fs.appendFileSync(OUT, `[${ts()}] ${line}\n`);
};

async function resolveTarget() {
  const targets = await fetchJson(METRO_JSON);
  const target =
    targets.find((t) => t.webSocketDebuggerUrl && t.type === 'node') ||
    targets.find((t) => t.webSocketDebuggerUrl);
  if (!target || !target.webSocketDebuggerUrl) {
    throw new Error('no inspector target found');
  }
  return target.webSocketDebuggerUrl;
}

async function connectOnce() {
  const url = await resolveTarget();
  const socket = new WS(url);
  socket.on('open', () => {
    socket.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
    socket.send(JSON.stringify({ id: 2, method: 'Log.enable' }));
    socket.send(JSON.stringify({ id: 3, method: 'Console.enable' }));
    log('--- [capture] attached to inspector: ' + url);
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
      const p = msg.params || {};
      const type = p.type || 'log';
      const args = (p.args || []).map((a) => a.value ?? a.description ?? a.unserializableValue ?? '').join(' ');
      log(`[console.${type}] ${args}`);
    } else if (m === 'Log.entryAdded') {
      const e = (msg.params || {}).entry || {};
      log(`[log.${e.level || 'info'}] ${e.text || ''}`);
    } else if (m === 'Runtime.exceptionThrown') {
      const d = (msg.params || {}).exceptionDetails || {};
      const desc = (d.exception && (d.exception.description || d.exception.value)) || d.text || '';
      log(`[exception] ${desc}`);
    }
  });
  socket.on('close', () => {
    log('--- [capture] socket closed; reconnecting in 2s');
  });
  socket.on('error', (err) => {
    log('--- [capture] socket error: ' + err.message);
  });
  return socket;
}

log('--- [capture] starting continuous capture to ' + OUT);
let socket;
while (true) {
  try {
    if (!socket || socket.readyState !== 1) {
      socket = await connectOnce();
    }
  } catch (e) {
    log('--- [capture] resolve/connect failed: ' + e.message + ' (retry in 3s)');
  }
  await new Promise((r) => setTimeout(r, 3000));
}
