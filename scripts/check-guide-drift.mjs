#!/usr/bin/env node
/**
 * check-guide-drift.mjs  —  FIX-Task-25 item 6 (2026-09-13)
 * ---------------------------------------------------------------
 * Two lightweight, dependency-free documentation checks:
 *
 *  1. INDEX vs BODY  — for every canonical guide in
 *     cross-checked-and-consolidated/, compare each test case's description in
 *     the `## Test Case Index` table against the description in its own
 *     `### <TC-ID> · <description>` section heading. A row whose index text
 *     disagrees with its body can be scored against TWO different assertions
 *     (the TRD X-group shipped 'index X09 = "Me" tab removed' while body X09 was
 *     "Cart badge shows item count from multiple entry points" — see
 *     FIX-Task-25 item 5).
 *
 *  2. NOTES vs STATUS — for each tracker table row, flag any row whose Notes
 *     cell tells a different story from its Status cell. The archetype is
 *     TRD-TC-V01: the note already recorded "Superseded verdict: PASS" while the
 *     status cell still said STILL OPEN, which silently inflated the OPEN count
 *     for two QA rounds.
 *
 * Read-only. Exit 1 when a HARD finding exists (a row/heading that would make a
 * verdict ambiguous), 0 otherwise. Warnings never fail the run.
 *
 * Run from the repo root:  node scripts/check-guide-drift.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CC = join(ROOT, 'cross-checked-and-consolidated');

/** The 6 canonical guides (same set temp/tc-inventory-v2/parse_indexes_v2.py reads). */
const GUIDES = [
  'AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md',
  'MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md',
  'MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md',
  'MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md',
  'MODULE-ADMIN-PORTAL-MANUAL-TESTING.md',
  'MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md',
];

/** Trackers whose rows carry BOTH a status cell and a notes cell. */
const TRACKERS = [
  'TEST-COVERAGE-INVENTORY-v2.md',
  'e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md',
];

const TC_ID_RE = /\b([A-Z]{2,5}-TC-(?:REG-)?[A-Z]?\d+(?:[a-z])?(?:-[A-Za-z0-9]+)?)\b/;

const NEGATIVE_STATUS_RE = /STILL OPEN|STILL-OPEN|BLOCKED|FAIL|NOT RUN|PARTIAL|DEFERRED/i;
const SUPERSEDES_RE =
  /superseded verdict[^.|]*PASS|superseded[^.|]*\bPASS\b|(?:→|->)\s*PASS\b|now PASS|re-verified[^.|]*\bPASS\b|ratified/i;

/** Words ignored when measuring how far an index row has drifted from its body. */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is', 'are',
  'be', 'it', 'its', 'that', 'this', 'as', 'at', 'by', 'from', 'into', 'not', 'no',
  'via', 'per', 'plus', 'also',
]);

/** Normalise a description so punctuation-only differences don't report. */
function normalise(text) {
  return String(text ?? '')
    .replace(/[*_`~]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[—–]/g, '-')
    .replace(/[""'']/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/[.;:,\s]+$/, '')
    .trim()
    .toLowerCase();
}

/** Content words of a description, for the drift measure. */
function tokens(text) {
  return new Set(
    normalise(text)
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/[\s-]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

/**
 * How much of the SHORTER description is covered by the LONGER one.
 * 1.0 means the shorter is a pure abbreviation of the longer (normal in these
 * guides: the index summarises, the body elaborates). A low score means the two
 * describe different things — the TRD X-group defect, where index X09 described
 * "Me tab removed" while body X09 tested the cart badge.
 */
function containment(a, b) {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  const [small, large] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  let hit = 0;
  for (const t of small) if (large.has(t)) hit += 1;
  return hit / small.size;
}

/** Below this, the index row and its body are describing different things. */
const DIVERGENCE_THRESHOLD = 0.5;

function cells(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return null;
  const parts = trimmed.split('|');
  // Drop the leading/trailing empty segments produced by the outer pipes.
  return parts.slice(1, parts.length - 1).map((c) => c.trim());
}

// ---------------------------------------------------------------- check 1
/** A RETIRED/REMOVED/FIXTURE-GATED row legitimately carries different index vs
 *  body wording (the index states the disposition, the body keeps the original
 *  assertion). */
const DISPOSITION_RE = /retired|removed|fixture-gated|moved to|backlog|not implemented/i;

function checkIndexVsBody() {
  const divergent = [];
  const abbreviated = [];
  const duplicates = [];
  const dispositions = [];
  const warn = [];

  for (const file of GUIDES) {
    const path = join(CC, file);
    if (!existsSync(path)) {
      warn.push(`${file}: not found — skipped`);
      continue;
    }
    const lines = readFileSync(path, 'utf8').split('\n');

    // ---- index descriptions
    const index = new Map();
    let inIndex = false;
    for (const line of lines) {
      if (line.startsWith('## Test Case Index')) {
        inIndex = true;
        continue;
      }
      if (inIndex && /^## /.test(line)) break;
      if (!inIndex) continue;
      const c = cells(line);
      if (!c || c.length < 2) continue;
      const idCellIdx = c.findIndex((cell) => TC_ID_RE.test(cell) && cell.length < 40);
      if (idCellIdx === -1) continue;
      const id = (c[idCellIdx].match(TC_ID_RE) || [])[1];
      const description = c[idCellIdx + 1];
      if (id && description && !description.startsWith('---')) index.set(id, description);
    }

    // ---- body headings  `### TRD-TC-X01 · Bottom nav renders ...`
    // The optional leading lowercase word covers the "### passed TRD-TC-R01 · …"
    // headings this guide grew — a status word pasted into the heading used to
    // hide those sections from every heading parser.
    const headingRe = /^###\s+(?:[a-z][a-z-]*\s+)?([A-Z]{2,5}-TC-[A-Za-z0-9-]+)\s*[·—:-]\s*(.+?)\s*$/;
    const headLines = new Map(); // id -> [{ desc, line }]
    for (const [i, line] of lines.entries()) {
      const m = line.match(headingRe);
      if (!m) continue;
      const id = m[1];
      if (!headLines.has(id)) headLines.set(id, []);
      headLines.get(id).push({ desc: m[2], line: i + 1 });
    }

    // Duplicate section headings for the same TC-ID make a verdict ambiguous:
    // "TRD-TC-R01" ships twice (the refund/cancel state machine AND the
    // regression set), so the ID alone no longer identifies one assertion.
    for (const [id, list] of headLines) {
      if (list.length > 1) {
        duplicates.push({
          file,
          id,
          lines: list.map((l) => l.line),
          variants: [...new Set(list.map((l) => l.desc))],
        });
      }
    }

    // Compare the index row against the FIRST body section for that id.
    const body = new Map();
    for (const [id, list] of headLines) body.set(id, list[0].desc);

    for (const [id, indexText] of index) {
      const bodyText = body.get(id);
      if (!bodyText) continue; // index-only rows are reported by the coverage pipeline
      if (normalise(indexText) === normalise(bodyText)) continue;
      if (DISPOSITION_RE.test(indexText) && DISPOSITION_RE.test(bodyText)) {
        dispositions.push({ file, id }); // documented retirement — wording differs by design
        continue;
      }
      const score = containment(indexText, bodyText);
      const row = { file, id, index: indexText, body: bodyText, score };
      if (score < DIVERGENCE_THRESHOLD) {
        divergent.push(row); // describes something else — the class worth fixing
      } else {
        abbreviated.push(row); // normal: the index summarises the body
      }
    }
  }
  return { divergent, abbreviated, duplicates, dispositions, warn };
}

// ---------------------------------------------------------------- check 2
/** A cell counts as the STATUS cell when it carries a verdict marker. */
const STATUS_CELL_RE = /✅|🟡|🔴|📄|⏭️|❌|🔁|🗑️|\bPASS\b|\bFAIL\b|\bBLOCKED\b|\bPARTIAL\b|STILL OPEN|STILL-OPEN|NOT RUN|DOC-DRIFT|SKIPPED|RETIRED|REMOVED/i;

function checkNotesVsStatus() {
  const hard = [];
  const warn = [];

  for (const rel of TRACKERS) {
    const path = join(ROOT, rel);
    if (!existsSync(path)) {
      warn.push(`${rel}: not found — skipped`);
      continue;
    }
    const lines = readFileSync(path, 'utf8').split('\n');
    for (const [i, line] of lines.entries()) {
      const c = cells(line);
      if (!c || c.length < 3) continue;
      const idIdx = c.findIndex((cell) => TC_ID_RE.test(cell) && cell.length < 40);
      if (idIdx === -1) continue;
      const id = (c[idIdx].match(TC_ID_RE) || [])[1];

      const notesIdx = c.length - 1;
      if (notesIdx <= idIdx) continue;
      const notes = c[notesIdx];

      // Status = the FIRST verdict-marked cell after the ID, never the notes cell
      // (several trackers repeat the verdict icon inside the notes text).
      let statusText = '';
      for (let k = idIdx + 1; k < notesIdx; k++) {
        if (STATUS_CELL_RE.test(c[k])) {
          statusText = c[k];
          break;
        }
      }
      if (!statusText) continue;

      const lineNo = i + 1;
      // An explicit PASS/✅ inside the status cell wins: several status cells read
      // like a sentence ("Payment-failed webhook → retry/grace — PASS"), and a
      // bare keyword scan would read that as a failure.
      const statusSaysPass = /✅|\bPASS\b/i.test(statusText);
      const statusIsNegative = !statusSaysPass && NEGATIVE_STATUS_RE.test(statusText);
      const statusIsPass = statusSaysPass;

      // (a) status still open/failed while the note records the supersession.
      //     This is the TRD-TC-V01 archetype: the note already said "Superseded
      //     verdict: PASS" while the cell kept reading STILL OPEN, which inflated
      //     the OPEN count for two QA rounds.
      if (statusIsNegative && SUPERSEDES_RE.test(notes)) {
        hard.push({
          file: rel,
          line: lineNo,
          id,
          why: 'notes record a superseding PASS but the STATUS cell still reads a non-PASS verdict',
          status: statusText,
          notes,
        });
        continue;
      }

      // (b) status PASS while the note asserts a CURRENT failure. Deliberately
      //     narrow: most notes legitimately narrate history ("was BLOCKED",
      //     "08-28 FAIL then PASS after the trigger was recreated", "4th block
      //     prevented") — only an explicit still/remains/not-yet claim is a
      //     contradiction.
      const liveNegative = notes.match(
        /\b(still|remains?|currently|not yet|yet to)\b[^.;]{0,40}\b(FAIL|FAILED|OPEN|BLOCKED|NOT RUN|BROKEN|PENDING)\b/i
      );
      if (statusIsPass && liveNegative) {
        hard.push({
          file: rel,
          line: lineNo,
          id,
          why: 'STATUS cell reads PASS but the NOTES cell asserts the case is still failing/blocked',
          status: statusText,
          notes,
        });
      }
    }
  }
  return { hard, warn };
}

// ---------------------------------------------------------------- run
const idx = checkIndexVsBody();
const tracker = checkNotesVsStatus();

const hardCount = tracker.hard.length;
const warnCount = idx.divergent.length + idx.abbreviated.length + idx.warn.length + tracker.warn.length;

console.log('Guide drift check');
console.log('=================');

console.log(
  `\n1) Guide structure  — ${idx.duplicates.length} duplicate TC-ID section(s), ${idx.divergent.length} divergent index row(s), ${idx.abbreviated.length} abbreviated-and-fine, ${idx.dispositions.length} retired-by-design`
);
if (idx.duplicates.length === 0) {
  console.log('   OK — every TC-ID has exactly one body section.');
} else {
  for (const d of idx.duplicates) {
    console.log(`   DUPLICATE TC-ID ${d.id}  (${d.file}: lines ${d.lines.join(', ')})`);
    for (const v of d.variants) console.log(`     · ${v}`);
  }
}
if (idx.divergent.length === 0) {
  console.log('   OK — no index row describes a different test than its own body section.');
} else {
  for (const f of idx.divergent) {
    console.log(`   DIVERGENT ${f.id}  (${f.file})  [overlap ${f.score.toFixed(2)}]`);
    console.log(`     index: ${f.index}`);
    console.log(`     body : ${f.body}`);
  }
}

console.log(
  `\n2) Tracker notes vs status  (${tracker.hard.length} contradiction${tracker.hard.length === 1 ? '' : 's'}, ${tracker.warn.length} advisory)`
);
if (tracker.hard.length === 0) {
  console.log('   OK — no row contradicts itself.');
} else {
  for (const f of tracker.hard) {
    console.log(`   CONTRADICTION ${f.id}  (${f.file}:${f.line})`);
    console.log(`     why   : ${f.why}`);
    console.log(`     status: ${f.status}`);
    console.log(`     notes : ${f.notes.slice(0, 200)}`);
  }
}
if (tracker.warn.length > 0) {
  console.log('\n   Advisory (no rationale on a blocked/open row):');
  for (const f of tracker.warn) {
    console.log(`     · ${f.id} (${f.file}:${f.line}) — notes: ${f.notes.slice(0, 120)}`);
  }
}

console.log(
  `\nSummary: ${hardCount} hard finding(s) (notes vs status), ${warnCount} warning(s). Advisory findings never fail this run.`
);
process.exit(hardCount > 0 ? 1 : 0);
