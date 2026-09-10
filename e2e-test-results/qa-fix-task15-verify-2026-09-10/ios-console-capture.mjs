// QA evidence helper (FIX-Task-15 verification round, 2026-09-10).
// Read-only capture of the RN JS console via the Hermes/Metro CDP inspector,
// per QA playbook §5.12 (the unified iOS device log does NOT carry console.*).
//
// Usage: node ios-console-capture.mjs [seconds] [filterRegex]
import { createRequire } from 'node:module';

const require = createRequire(
  '/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/package.json'
);
const WebSocket = require('ws');

const seconds = Number(process.argv[2] || 30);
const filter = new RegExp(process.argv[3] || '.');
const METRO = process.env.METRO_URL || 'http://localhost:8081';

function log(line) {
  console.log(`[capture] ${line}`);
}

let nextId = 100;
const pendingProps = new Map();

async function main() {
  const res = await fetch(`${METRO}/json`);
  const targets = await res.json();
  for (const t of targets) {
    log(`TARGET: ${t.title || t.description || '?'}`);
  }
  const want = process.env.TARGET_MATCH || '';
  const target = want
    ? targets.find((t) => t.webSocketDebuggerUrl && `${t.title || ''}${t.description || ''}`.includes(want))
    : targets.find((t) => t.webSocketDebuggerUrl && !/android|sdk_gphone/i.test(`${t.title || ''}${t.description || ''}`));
  if (!target) {
    log('NO_TARGET — no matching RN target on Metro');
    process.exit(0);
  }
  log(`connected to ${target.title || target.description || 'RN target'}`);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.on('open', () => {
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
    ws.send(JSON.stringify({ id: 2, method: 'Log.enable' }));
    ws.send(JSON.stringify({ id: 3, method: 'Console.enable' }));
    log('listening…');
  });
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const type = msg.params?.type ?? 'log';
      const text = (msg.params?.args ?? [])
        .map((a) => {
          if (a.value !== undefined) return a.value;
          const props = a.preview?.properties ?? a.preview?.overflow;
          if (Array.isArray(a.preview?.properties)) {
            return a.preview.properties.map((p) => `${p.name}=${p.value}`).join(' ');
          }
          return a.description ?? props ?? '';
        })
        .join(' ');
      if (filter.test(text)) log(`CONSOLE ${type}: ${text}`);
      if (/scroll metrics/.test(text)) {
        log(`RAWARGS ${JSON.stringify(msg.params?.args ?? [])}`);
        const objArg = (msg.params?.args ?? []).find((a) => a.objectId);
        if (objArg && ws.readyState === 1) {
          const id = nextId++;
          pendingProps.set(id, 'scroll metrics');
          ws.send(
            JSON.stringify({
              id,
              method: 'Runtime.getProperties',
              params: { objectId: objArg.objectId, ownProperties: true },
            })
          );
        }
      }
    } else if (msg.method === 'Log.entryAdded') {
      const entry = msg.params?.entry ?? {};
      const text = `${entry.level}: ${entry.text}`;
      if (filter.test(text)) log(`LOG ${text}`);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const text = msg.params?.exceptionDetails?.text ?? '';
      if (filter.test(text)) log(`EXCEPTION: ${text}`);
    } else if (msg.id !== undefined && pendingProps.has(msg.id)) {
      const label = pendingProps.get(msg.id);
      pendingProps.delete(msg.id);
      const props = msg.result?.result ?? [];
      const flat = props
        .filter((p) => !p.name.startsWith('__'))
        .map((p) => `${p.name}=${p.value?.value ?? p.value?.description ?? '?'}`)
        .join(' ');
      log(`VALUES ${label}: ${flat || '(none)'}`);
    }
  });
  ws.on('error', (e) => log(`WS_ERROR ${e.message}`));

  setTimeout(() => {
    log('window closed');
    try {
      ws.close();
    } catch {
      /* noop */
    }
    process.exit(0);
  }, seconds * 1000);
}

main().catch((e) => {
  log(`FATAL ${e.message}`);
  process.exit(1);
});
