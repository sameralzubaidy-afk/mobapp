/**
 * QA tool — transcript call-ledger miner (DT-124 item 6, the decision log's I-6).
 *
 * Produces EXACT per-phase + per-tool tool-call counts from a Copilot agent
 * session transcript (the VS Code GitHub.copilot-chat transcripts JSONL). This
 * replaces manual mid-run estimates, which QA Task 37 proved unreliable (a
 * "~110–120" estimate was actually 211 mined) — R71 in the QA playbook now
 * prohibits reporting an estimate as a comparison.
 *
 * Transcript format (per line, one JSON object):
 *   { id, timestamp, parentId, type: "user.message" | "assistant.message" |
 *     "assistant.turn_start" | "assistant.turn_end" |
 *     "tool.execution_start" | "tool.execution_complete" | ..., data }
 * Tool calls = tally records of type "tool.execution_start"
 *   (data.toolName + data.toolCallId). Each call is attributed to the most
 *   recent message index seen, so phases can be sliced by message ranges.
 *
 * Usage (from p2p-kids-marketplace):
 *   npm run qa:mine-call-ledger -- <transcript.jsonl> [--phases "A:1-25,B:26-60"]
 *     --phases   "Label:start-end,Label:start-end" (1-based inclusive message
 *                ranges, as used by the QA decision logs, e.g. Batch B 61-263)
 *     --by-turn  print a per-user-turn breakdown instead of (or before) --phases
 *     --json     machine-readable output (default is a human table)
 *   npm run qa:mine-call-ledger -- --dir <transcriptsDir>   # per-file totals
 *
 * Locating a transcript: transcripts live under
 *   ~/Library/Application Support/Code/User/workspaceStorage/<ws>/GitHub.copilot-chat/transcripts/<session>.jsonl
 * Pick the newest .jsonl for the session you just finished.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const PHASES_SPEC = argValue('phases');
const BY_TURN = hasFlag('--by-turn');
const AS_JSON = hasFlag('--json');
const DIR = argValue('dir');

function argValue(name) {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
}
function hasFlag(name) {
  return args.includes('--' + name);
}

function parseTranscript(filePath) {
  let lines = [];
  try {
    lines = readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  } catch (e) {
    console.error(`❌ Cannot read ${filePath}: ${e.message}`);
    process.exit(2);
  }
  const msgs = []; // {index, type, preview}
  const calls = []; // {tool, msgIndex}
  let lastMsgIndex = 0;
  for (const line of lines) {
    let rec = null;
    try {
      rec = JSON.parse(line);
    } catch {
      continue; // partial/empty line
    }
    const type = rec?.type;
    if (!type) continue;
    if (type === 'user.message' || type === 'assistant.message') {
      lastMsgIndex += 1;
      const content = rec?.data?.content;
      const preview = typeof content === 'string'
        ? content.replace(/\s+/g, ' ').slice(0, 60)
        : (rec?.data?.messageId ? '(message)' : '');
      msgs.push({ index: lastMsgIndex, type, preview });
    } else if (type === 'tool.execution_start') {
      calls.push({ tool: rec?.data?.toolName ?? 'unknown', msgIndex: lastMsgIndex });
    }
  }
  return { totalMsgs: lastMsgIndex, msgs, calls };
}

function perToolTable(calls) {
  const map = {};
  for (const c of calls) map[c.tool] = (map[c.tool] ?? 0) + 1;
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function slice(calls, fromMsg, toMsg) {
  return calls.filter((c) => c.msgIndex >= fromMsg && c.msgIndex <= toMsg);
}

function buildReport(p) {
  const { totalMsgs, calls } = p;
  const report = { totalMsgs, totalCalls: calls.length, perTool: perToolTable(calls) };
  if (PHASES_SPEC) {
    report.phases = PHASES_SPEC.split(',').map((spec) => {
      const [label, range] = spec.split(':');
      const [a, b] = range.split('-').map((n) => parseInt(n, 10));
      return { label, from: a, to: b, calls: slice(calls, a, b).length };
    });
  }
  if (BY_TURN) {
    // Group calls by the user.message turn that preceded them.
    const turns = [];
    let current = null;
    for (const m of p.msgs) {
      if (m.type !== 'user.message') continue;
      if (current) {
        current.calls = slice(calls, current.from, m.index - 1).length;
        turns.push(current);
      }
      current = { label: m.preview, from: m.index, to: m.index, calls: 0 };
    }
    if (current) {
      current.calls = slice(calls, current.from, totalMsgs).length;
      turns.push(current);
    }
    report.turns = turns.filter((t) => t.calls > 0);
  }
  return report;
}

// ---- Main ----
function main() {
  if (DIR) {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.jsonl')).map((f) => resolve(DIR, f));
    const rows = files.map((f) => {
      const { totalMsgs, calls } = parseTranscript(f);
      return { file: f.split('/').pop(), msgs: totalMsgs, calls: calls.length };
    }).sort((a, b) => b.calls - a.calls);
    if (AS_JSON) {
      console.log(JSON.stringify(rows, null, 2));
    } else {
      console.log('Per-file tool-call totals (desc):');
      for (const r of rows) console.log(`  ${r.calls.toString().padStart(5)}  calls  ${r.msgs.toString().padStart(4)} msgs  ${r.file}`);
      console.log(`\nTOTAL files: ${rows.length}`);
    }
    return;
  }

  const fileArg = args.find((a) => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
  if (!fileArg) {
    console.error('Usage: npm run qa:mine-call-ledger -- <transcript.jsonl> [--phases ...] [--by-turn] [--json] | --dir <dir>');
    process.exit(2);
  }
  const filePath = resolve(process.cwd(), fileArg);
  const p = parseTranscript(filePath);
  const out = buildReport(p);

  if (AS_JSON) {
    const { totalMsgs, calls } = p;
    const phases = out.phases ?? [];
    const turns = out.turns ?? [];
    console.log(JSON.stringify({ file: filePath, totalMsgs, totalCalls: calls.length, perTool: out.perTool, phases, turns }, null, 2));
    return;
  }

  console.log(`Transcript: ${filePath}`);
  console.log(`Messages: ${p.totalMsgs} · Tool executions (tool.execution_start): ${p.calls.length}\n`);

  console.log('Per-tool totals (top):');
  for (const [tool, count] of out.perTool) console.log(`  ${count.toString().padStart(5)}  ${tool}`);

  if (out.phases?.length) {
    console.log('\nPhases (exact call counts by msg range):');
    for (const ph of out.phases) {
      console.log(`  ${ph.label.padEnd(24)} msgs ${ph.from}-${ph.to}  ${ph.calls} calls`);
    }
  }
  if (out.turns?.length) {
    console.log('\nPer-user-turn calls:');
    for (const t of out.turns) console.log(`  msgs ${t.from}-${t.to}  ${t.calls} calls  ${t.label}`);
  }
  console.log('\n✅ mine complete — use these EXACT counts in any report comparison (R71).');
}

main();
