#!/usr/bin/env node
/**
 * FIX-Task-37 item 7 — add explicit per-platform verdict columns to the coverage tracker.
 *
 * FILE: scripts/add-tracker-platform-columns.mjs
 *
 * WHY
 * ---
 * `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` had a single, platform-agnostic
 * `Status` column. An Android-only PARTIAL therefore had to live in the free-text
 * `Notes` cell (e.g. "Status ✅ PASS while Latest 🟡 PARTIAL (Android)"), where it could
 * not be counted — so an iOS PASS masked an Android PARTIAL.
 *
 * This inserts two columns, `iOS` and `Android`, immediately after `Status` in the six
 * "Completed test cases" tables:
 *
 *     | TC-ID | Description | Status | iOS | Android | Latest | Date | Source | Notes |
 *
 * POPULATION POLICY (deliberately conservative — no invented evidence)
 * -------------------------------------------------------------------
 *   iOS     = the row's own headline `Status` verdict. The tracker's historical baseline
 *             was iOS / platform-agnostic execution, so the headline verdict IS the
 *             iOS verdict for every row on record.
 *   Android = an explicit Android-qualified verdict parsed out of the row's `Notes`
 *             (patterns like "**Android 2026-09-16: 🟡 PARTIAL**" or "(Android)"),
 *             otherwise `—` meaning "no Android-qualified verdict on record".
 *
 * A `—` is NOT "not run" — it means this row carries no Android-specific verdict. Do not
 * read it as a failure.
 *
 * WHY A SCRIPT AND NOT HAND EDITS
 * -------------------------------
 * ~890 data rows across 6 tables. Hand-editing them is impractical and error-prone.
 *
 * ⚠️ DO NOT run the abandoned generators instead of this script:
 *    temp/tc-inventory-v2/build_status_tracker.py / generate_inventory_v2.py.
 *    They REGENERATE the whole file from the stale data layer and DROP every hand-written
 *    round note (measured: 1102 -> 981 lines, round notes 1 -> 0). This script only ever
 *    INSERTS two cells per row and rewrites the header lines; every other byte is preserved.
 *    (See QA playbook §5.54 R52.5.)
 *
 * PARSER CONTRACT (scripts/check-guide-drift.mjs, npm run verify:guides)
 * ---------------------------------------------------------------------
 *   * `Notes` must remain the LAST column  -> the new cells are inserted BEFORE `Latest`.
 *   * `Status` must remain the FIRST status-matching cell after the TC-ID -> it stays at
 *     index 2, and the status detector picks it before ever looking at `iOS`.
 *   * The new header text must not look like a TC-ID -> "iOS"/"Android" are safe.
 *
 * IDEMPOTENT: re-running is a no-op (it detects the 9-column header and aborts).
 *
 * USAGE
 *   node scripts/add-tracker-platform-columns.mjs --dry-run   # default
 *   node scripts/add-tracker-platform-columns.mjs --write
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const TRACKER = resolve(ROOT, 'e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md');

/** The 7-column Completed-table header this script upgrades. */
const OLD_HEADER = '| TC-ID | Description | Status | Latest | Date | Source | Notes |';
/** The 9-column header it writes. */
const NEW_HEADER = '| TC-ID | Description | Status | iOS | Android | Latest | Date | Source | Notes |';

const EMPTY = '—';

/**
 * Pull an explicit Android verdict out of a row's notes.
 * Matches the shapes actually used in this tracker, e.g.
 *   "**Android 2026-09-16: 🟡 PARTIAL** — ..."
 *   "ANDROID 2026-09-08 (persona test-seller-2, fixture trades): ... DOC-DRIFT holds"
 *   "Latest 🟡 PARTIAL (Android)"
 */
function androidVerdictFrom(text) {
  if (!text) return EMPTY;

  // "Android <date>: <emoji>? <VERDICT>" — the most common, most explicit form.
  const dated = text.match(
    /Android\s+\d{4}-\d{2}-\d{2}\s*:\s*(?:[^A-Za-z]{0,4})?(PASS|PARTIAL|FAIL|BLOCKED|SKIPPED|DOC-DRIFT|NOT-SUPPORTED)/i
  );
  if (dated) return dated[1].toUpperCase();

  // "PARTIAL (Android)" / "PASS (Android)" — verdict first, platform in parens.
  const parenthesised = text.match(
    /(PASS|PARTIAL|FAIL|BLOCKED|SKIPPED|DOC-DRIFT)\s*\(Android\)/i
  );
  if (parenthesised) return parenthesised[1].toUpperCase();

  // An Android round that explicitly held a verdict open ("Android-only round").
  if (/ANDROID\s+\d{4}-\d{2}-\d{2}/i.test(text)) {
    const held = text.match(/DOC-DRIFT holds/i);
    if (held) return 'DOC-DRIFT';
  }

  return EMPTY;
}

function main() {
  const write = process.argv.includes('--write');
  const original = readFileSync(TRACKER, 'utf8');
  const lines = original.split('\n');

  if (lines.some((l) => l.trim() === NEW_HEADER)) {
    console.log('ℹ️  Already migrated — the 9-column header is present. Nothing to do.');
    process.exit(0);
  }

  let inCompletedTable = false;
  let headersRewritten = 0;
  let rowsUpgraded = 0;
  const skipped = [];

  const out = lines.map((line) => {
    if (line.trim() === OLD_HEADER) {
      headersRewritten += 1;
      inCompletedTable = true;
      return NEW_HEADER;
    }

    // Any of these forms a table boundary and leaves Completed-table context:
    //   * a non-table line (heading, blank, blockquote, prose)
    //   * a DIFFERENT table's header — every one of them starts with `| TC-ID |`
    //     (the 3-column disposition tables), and none of them is OLD_HEADER.
    // Everything else that starts with `|` is data or a separator row and keeps the
    // current context. (Getting this wrong is what made a first draft upgrade only
    // the 6 rows immediately under each header.)
    if (!line.startsWith('|')) {
      inCompletedTable = false;
      return line;
    }
    if (line.startsWith('| TC-ID') && line.trim() !== OLD_HEADER) {
      inCompletedTable = false;
      return line;
    }

    if (!inCompletedTable || !line.startsWith('|')) return line;

    let cells = line.split('|');
    // A well-formed 7-column row splits into 9 parts:
    //   ['', ID, Description, Status, Latest, Date, Source, Notes, '']
    //
    // 11 rows in the tracker omit the trailing (empty) Notes cell and split into 8
    // parts: ['', ID, Description, Status, Latest, Date, Source, '']. Markdown tolerates
    // a short row, so rather than skipping them (which would leave them misaligned
    // under a 9-column header) normalise them to 7 logical cells with an empty Notes.
    if (cells.length === 8) {
      cells = [...cells.slice(0, 7), ' ', ''];
    }
    if (cells.length !== 9) {
      skipped.push(`cells=${cells.length}: ${line.slice(0, 90)}`);
      return line;
    }

    const status = cells[3].trim();
    const notes = cells[7];
    const android = androidVerdictFrom(notes);
    const ios = status || EMPTY;

    rowsUpgraded += 1;
    // Keep '', ID, Description, Status at their original positions, insert iOS +
    // Android immediately AFTER Status, then keep the untouched tail
    // (Latest | Date | Source | Notes | '').
    return [
      cells[0],
      cells[1],
      cells[2],
      cells[3],
      ` ${ios} `,
      ` ${android} `,
      ...cells.slice(4),
    ].join('|');
  });

  const updated = out.join('\n');

  console.log(`headers rewritten : ${headersRewritten} (expected 6)`);
  console.log(`data rows upgraded : ${rowsUpgraded}`);
  console.log(`rows skipped       : ${skipped.length}`);
  if (skipped.length) {
    console.log('\n⚠️  Rows left at 7 columns (would misalign under the 9-column header):');
    for (const s of skipped.slice(0, 25)) console.log(`   - ${s}`);
    if (skipped.length > 25) console.log(`   ... and ${skipped.length - 25} more`);
  }
  console.log(`line count         : ${lines.length} -> ${out.length}`);

  if (headersRewritten !== 6) {
    console.error('❌ Expected exactly 6 Completed-table headers. Aborting without writing.');
    process.exit(1);
  }

  if (skipped.length) {
    console.error(
      '\n❌ Refusing to write while any in-table row would be left misaligned.\n' +
        '   Resolve the listed rows (usually a literal `|` inside a cell) first.'
    );
    process.exit(1);
  }

  if (!write) {
    console.log('\n(dry run — pass --write to apply)');
    process.exit(0);
  }

  writeFileSync(TRACKER, updated, 'utf8');
  console.log('\n✅ Written. Now run: npm run verify:guides');
}

main();
