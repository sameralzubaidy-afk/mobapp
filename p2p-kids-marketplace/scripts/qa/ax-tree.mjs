#!/usr/bin/env node
/**
 * qa:ax-tree — anchored lookup over a mobile-mcp AX-tree resource file.
 *
 * The mobile-mcp `list_elements_on_screen` tool truncates its INLINE output at
 * ~2,000 chars, but the underlying resource file it is generated from holds the
 * full tree (17KB+ observed). Previously the QA agent had to hand-grep the file
 * (`grep -o '"name":"…"'`) then fall back to reading the file and OCR — a
 * three-hop dance. This script makes the primary lookup path reliable:
 * anchor-based filtering + pagination, no truncation.
 *
 * Usage:
 *   node scripts/qa/ax-tree.mjs <resource-file> [--name <substring>] [--max N] \
 *     [--screen-width W] [--screen-height H] [--pill-top N] [--pill-bottom M]
 *
 *   <resource-file>  path to the mobile-mcp element-tree resource file
 *                    (JSON or a text file containing a JSON blob)
 *   --name <substr>  case-insensitive anchor: only print elements whose
 *                    name/label/text/testID contains <substr> (e.g. "Confirm")
 *   --max N          cap printed matches (default 40); pass 0 for no cap
 *   --list           print only names/labels (no coordinates) — compact grep
 *   --raw            dump the raw JSON (normalized) instead of a table
 *
 * VIEWPORT / OCCLUSION FLAGS (Dev Task 44 item 2): when the screen geometry is
 * known, every printed element is annotated so the QA agent can avoid the class
 * of silent no-op taps this run hit twice (off-screen Send Offer button;
 * occluded Report Problem button under the floating tab pill):
 *   --screen-width W   viewport width  in POINTS (e.g. 440 for iPhone 17 Pro Max)
 *   --screen-height H  viewport height in POINTS (e.g. 956 for iPhone 17 Pro Max)
 *   --pill-top N       y of the top edge of the floating tab pill band (points)
 *   --pill-bottom M    y of the bottom edge of the pill band (points)
 *   --header-bottom N  y of the bottom edge of a pinned/fixed header band
 *                      (points). Content whose LOGICAL y starts under the band
 *                      (but extends below it) is flagged — its reported y is not
 *                      the rendered tap point (the QA MSG run P2/P3 mis-tap
 *                      trap: a scrolled toggle sat at y94 under the header and
 *                      the tap hit the header bell instead).
 *   If --screen-height is omitted, a best-effort value is auto-detected from the
 *   tree (a top-level screen/window object, else the max element bottom). Pass
 *   --pill-top/--pill-bottom only when you need the occlusion flag.
 *
 * Output: one row per matched element with its coordinates (POINTS, matching
 * the AX tree — remember screenshots are 3x, so multiply by 3 for pixel
 * regions, per QA playbook §5.1 Phase 13.42). Elements flagged with
 * "⚠ below-viewport" start below the visible screen; "⚠ under-pill" overlap
 * the floating tab pill band.
 *
 * Read-only; no side effects. Not part of the app runtime.
 */
import { readFileSync, existsSync } from 'node:fs';

const [file, ...flags] = process.argv.slice(2);
const args = flags;

function valueOf(name) {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

function usage() {
  console.error(
    'usage: node scripts/qa/ax-tree.mjs <resource-file> [--name <substring>] [--max N] [--list] [--raw] [--screen-width W] [--screen-height H] [--pill-top N] [--pill-bottom M] [--header-bottom N]'
  );
  process.exit(2);
}

if (!file) usage();
if (!existsSync(file)) {
  console.error(`ERROR: file not found: ${file}`);
  process.exit(3);
}

const nameFilter = valueOf('--name');
const maxRaw = valueOf('--max');
const max = maxRaw === undefined ? 40 : Number(maxRaw) === 0 ? Infinity : Number(maxRaw);
const listOnly = args.includes('--list');
const rawDump = args.includes('--raw');

// Viewport / occlusion geometry (Dev Task 44 item 2) — all in POINTS.
const screenWidthRaw = valueOf('--screen-width');
const screenHeightRaw = valueOf('--screen-height');
const pillTopRaw = valueOf('--pill-top');
const pillBottomRaw = valueOf('--pill-bottom');
const headerBottomRaw = valueOf('--header-bottom');
const screenWidth = screenWidthRaw ? Number(screenWidthRaw) : undefined;
const screenHeight = screenHeightRaw ? Number(screenHeightRaw) : undefined;
const pillTop = pillTopRaw ? Number(pillTopRaw) : undefined;
const pillBottom = pillBottomRaw ? Number(pillBottomRaw) : undefined;
const headerBottom = headerBottomRaw ? Number(headerBottomRaw) : undefined;

// ─── Parse: try JSON, then JSON-embedded-in-text ───────────────────────────
let parsed;
const rawText = readFileSync(file, 'utf8');
try {
  parsed = JSON.parse(rawText);
} catch {
  // The resource file may embed the JSON in prose/logs. Grab the outermost
  // JSON array/object via a lightweight brace scan.
  const start = rawText.search(/[[{]/);
  const end = rawText.lastIndexOf(start === -1 ? ']' : rawText[start] === '[' ? ']' : '}');
  if (start === -1 || end <= start) {
    console.error(`ERROR: no JSON found in ${file}`);
    process.exit(4);
  }
  try {
    parsed = JSON.parse(rawText.slice(start, end + 1));
  } catch (e) {
    console.error(`ERROR: could not parse element tree: ${e.message}`);
    process.exit(4);
  }
}

// ─── Flatten nested trees into a flat element list ─────────────────────────
function coordOf(node) {
  const x = node?.x ?? node?.left ?? node?.origin_x ?? node?.origin?.x;
  const y = node?.y ?? node?.top ?? node?.origin_y ?? node?.origin?.y;
  const w = node?.width ?? node?.w ?? node?.size?.width;
  const h = node?.height ?? node?.h ?? node?.size?.height;
  return [x, y, w, h];
}

function labelOf(node) {
  return (
    node?.name ??
    node?.label ??
    node?.text ??
    node?.title ??
    node?.value ??
    node?.accessibilityLabel ??
    node?.testID ??
    node?.id ??
    ''
  );
}

function flatten(node, out) {
  if (!node || typeof node !== 'object') return out;
  if (typeof node.name === 'string' || typeof node.label === 'string') {
    out.push(node);
  }
  const children = node?.children ?? node?.elements ?? node?.items;
  if (Array.isArray(children)) {
    for (const child of children) flatten(child, out);
  }
  // Some serializations wrap the list directly in an array of arrays.
  return out;
}

const root = Array.isArray(parsed) ? parsed : [parsed];
const elements = [];
for (const r of root) flatten(r, elements);

if (elements.length === 0) {
  console.error(`WARNING: no element objects found in ${file} (looked for name/label keys)`);
}

// ─── Viewport geometry (Dev Task 44 item 2) — resolve auto-detected size ─────
// Priority: explicit --screen-* flags > a top-level screen/window/viewport
// object in the resource > max element bottom (best-effort content-height proxy).
let resolvedScreenHeight = screenHeight;
let resolvedScreenWidth = screenWidth;
if (resolvedScreenHeight === undefined || resolvedScreenWidth === undefined) {
  const firstRoot = (Array.isArray(parsed) ? parsed[0] : parsed) ?? {};
  const screenInfo =
    firstRoot?.screen ?? firstRoot?.window ?? firstRoot?.viewport ?? firstRoot?.bounds ?? firstRoot?.frame ?? {};
  const sw = Number(screenInfo?.width ?? screenInfo?.w);
  const sh = Number(screenInfo?.height ?? screenInfo?.h);
  if (resolvedScreenWidth === undefined && Number.isFinite(sw) && sw > 0) resolvedScreenWidth = sw;
  if (resolvedScreenHeight === undefined && Number.isFinite(sh) && sh > 0) resolvedScreenHeight = sh;
}
if (resolvedScreenHeight === undefined) {
  const maxBottom = elements.reduce((acc, el) => {
    const [, y, , h] = coordOf(el);
    if (y === undefined) return acc;
    return Math.max(acc, y + (h ?? 0));
  }, 0);
  if (maxBottom > 0) resolvedScreenHeight = maxBottom;
}

/** Per-element viewport/occlusion warnings (points, matches AX coords). */
function flagsOf(el) {
  const [x, y, w, h] = coordOf(el);
  const out = [];
  if (y === undefined) return out;
  const bottom = y + (h ?? 0);
  if (resolvedScreenHeight !== undefined && resolvedScreenHeight > 0) {
    if (y >= resolvedScreenHeight) {
      out.push('below-viewport (y ≥ screen height)');
    } else if (bottom > resolvedScreenHeight) {
      out.push('below-viewport (bottom extends past screen)');
    }
    if (
      resolvedScreenWidth !== undefined &&
      resolvedScreenWidth > 0 &&
      x !== undefined &&
      x + (w ?? 0) > resolvedScreenWidth
    ) {
      out.push('off-screen right');
    }
  }
  if (
    h !== undefined &&
    pillTop !== undefined &&
    pillBottom !== undefined &&
    y < pillBottom &&
    y + h > pillTop
  ) {
    out.push('under-pill (floating tab bar occlusion)');
  }
  // DEV-TASK-96 (item 3): header-band occlusion (QA MSG run P2/P3 mis-tap trap).
  // Flag content whose LOGICAL y starts above the pinned header's bottom edge
  // while the element still extends below it — such an element renders PARTLY
  // under the header, so its reported y is NOT a safe tap point. Header-native
  // elements (fully inside the band: bottom <= headerBottom) are intentionally
  // not flagged.
  if (
    h !== undefined &&
    headerBottom !== undefined &&
    y < headerBottom &&
    bottom > headerBottom
  ) {
    out.push('under-header (top edge hidden under pinned header)');
  }
  return out;
}

// ─── Filter by anchor ──────────────────────────────────────────────────────
let matches = elements;
if (nameFilter) {
  const needle = nameFilter.toLowerCase();
  matches = elements.filter((el) => String(labelOf(el)).toLowerCase().includes(needle));
}

if (rawDump) {
  process.stdout.write(JSON.stringify(matches.slice(0, max), null, 2) + '\n');
  process.exit(0);
}

if (listOnly) {
  for (const el of matches.slice(0, max)) process.stdout.write(`${labelOf(el)}\n`);
  process.stdout.write(`\n${matches.length} match(es)${nameFilter ? ` for "${nameFilter}"` : ''} (showing ${Math.min(matches.length, max)})\n`);
  process.exit(0);
}

// ─── Table output (name + coords), paginated ───────────────────────────────
process.stdout.write(`AX-tree: ${elements.length} element(s) in ${file}\n`);
if (nameFilter) process.stdout.write(`Filter: name/label contains "${nameFilter}"\n`);
if (resolvedScreenHeight !== undefined) {
  process.stdout.write(
    `Viewport: ${resolvedScreenWidth ?? '?'}x${resolvedScreenHeight} pt` +
      (pillTop !== undefined && pillBottom !== undefined
        ? ` · pill band y ${pillTop}–${pillBottom}`
        : '') +
      (headerBottom !== undefined ? ` · header band bottom y ${headerBottom}` : '') +
      ` (add --screen-height/--pill-top/--pill-bottom/--header-bottom to refine)\n`
  );
}
process.stdout.write('─'.repeat(72) + '\n');

const shown = matches.slice(0, max);
for (const el of shown) {
  const [x, y, w, h] = coordOf(el);
  const label = String(labelOf(el)).replace(/\s+/g, ' ').trim() || '(unnamed)';
  const coords =
    x !== undefined && y !== undefined
      ? `x=${x} y=${y}${w !== undefined ? ` w=${w}` : ''}${h !== undefined ? ` h=${h}` : ''}`
      : '(no coords)';
  process.stdout.write(`• ${label}\n    ${coords}\n`);
  const flags = flagsOf(el);
  if (flags.length) {
    process.stdout.write(`    ⚠ ${flags.join(' · ')}\n`);
  }
}

const total = matches.length;
if (total > shown.length) {
  process.stdout.write(`\n... ${total - shown.length} more match(es) — rerun with --max 0 or a tighter --name anchor.\n`);
}
process.stdout.write(`\n${total} match(es)${nameFilter ? ` for "${nameFilter}"` : ''} of ${elements.length} elements.\n`);
