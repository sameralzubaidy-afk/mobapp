#!/usr/bin/env node
/**
 * qa:ocr — macOS Vision OCR on a screenshot, or a cropped region of one.
 *
 * Usage:
 *   npm run qa:ocr -- --img <path> [--region x,y,w,h] [--json] [--coords]
 *
 *   --img <path>       screenshot file to OCR (required)
 *   --region x,y,w,h   crop region before OCR (optional; x,y top-left origin)
 *   --json             emit structured JSON instead of plain lines
 *   --coords           include each line's BOUNDING BOX in PIXELS (top-left
 *                      origin, original-image space) — FIX-Task-28 item 6
 *
 * FIX-Task-28 item 6 (2026-09-13): `--coords` exists so QA can resolve a tap
 * position from a screenshot alone. Previously the only coordinate source was a
 * mobile-mcp AX dump, and an AX dump issued while a deliberately-stalled screen is
 * pending can kill the dev client (SIGSEGV in the mobilecli JVMTI agent attach) —
 * i.e. exactly when a coordinate was most needed. See the QA playbook rule for the
 * AX-dump-in-stall-window ban.
 *
 * Output shapes:
 *   (no --coords, no --json)  one text line per recognized line (unchanged)
 *   --json                    { "text": string[] } (unchanged)
 *   --coords                  "<text>  {x:..,y:..,w:..,h:..}" per line
 *   --coords --json           [{ text, box: { x, y, w, h } }]
 *
 * Box coordinates are always in the ORIGINAL screenshot's pixel space: any
 * `--region` crop offset is added back (the crop is 1:1, never rescaled). Note the
 * pixels-vs-points distinction — an Android emulator screenshot is 1:1 with the
 * mobile-mcp AX tree, but an iOS screenshot is 2x/3x the AX point space.
 *
 * OCR runs the committed Swift helper scripts/qa/lib/vision_ocr.swift via
 * execFile('swift', [...]) — never an inline heredoc. If --region is given the
 * region is cropped with ImageMagick (`magick <img> -crop WxH+X+Y +repage`)
 * into /tmp/qa-ocr-* first. Transient crops live only under /tmp.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const execFileP = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const SWIFT_SCRIPT = join(__dirname, 'lib', 'vision_ocr.swift');
const args = process.argv.slice(2);

function valueOf(name) {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

function usage() {
  console.error(
    'usage: npm run qa:ocr -- --img <path> [--region x,y,w,h] [--json] [--coords]\n' +
      '  --img <path>       screenshot file to OCR (required)\n' +
      '  --region x,y,w,h   crop region before OCR (optional)\n' +
      '  --json             emit JSON instead of plain lines\n' +
      '  --coords           include each line\'s bounding box in PIXELS (top-left,\n' +
      '                     original-image space; --region offsets are added back)'
  );
  process.exit(2);
}

function parseRegion(spec) {
  if (!spec) return null;
  const m = /^(\d+),(\d+),(\d+),(\d+)$/.exec(String(spec).trim());
  if (!m) {
    console.error(`invalid --region '${spec}' — expected x,y,w,h (integers)`);
    usage();
  }
  const x = Number(m[1]);
  const y = Number(m[2]);
  const w = Number(m[3]);
  const h = Number(m[4]);
  if (w <= 0 || h <= 0) {
    console.error(`invalid --region '${spec}' — width/height must be > 0`);
    usage();
  }
  return { x, y, w, h };
}

const img = valueOf('--img');
const region = parseRegion(valueOf('--region'));
const asJson = args.includes('--json');
// FIX-Task-28 item 6: opt-in bounding boxes (normalized -> top-left pixels).
const wantsCoords = args.includes('--coords');

if (!img) usage();
if (!existsSync(img)) {
  console.error(`ERROR: image not found: ${img}`);
  process.exit(3);
}

// Optional ImageMagick crop into /tmp.
let target = img;
if (region) {
  const out = join(tmpdir(), `qa-ocr-${randomBytes(6).toString('hex')}.png`);
  try {
    await execFileP('magick', [
      img,
      '-crop',
      `${region.w}x${region.h}+${region.x}+${region.y}`,
      '+repage',
      out,
    ]);
  } catch (err) {
    console.error(`ERROR: ImageMagick crop failed: ${err.stderr?.trim() || err.message}`);
    process.exit(4);
  }
  target = out;
}

// Run Swift Vision OCR via execFile (no inline Swift, no heredoc).
let stdout;
try {
  ({ stdout } = await execFileP('swift', [
    SWIFT_SCRIPT,
    target,
    ...(wantsCoords ? ['--coords'] : []),
  ]));
} catch (err) {
  console.error(`ERROR: swift OCR failed: ${err.stderr?.trim() || err.message}`);
  process.exit(5);
}

const lines = stdout.split('\n').filter((line) => line.length > 0);

/**
 * Vision reports each box as a NORMALIZED rect with a BOTTOM-LEFT origin.
 * Convert it to integer top-left PIXEL coordinates and add back the --region
 * crop offset, so the result is always in the ORIGINAL screenshot's space.
 */
function toPixelBox(entry) {
  const box = entry.box ?? {};
  const iw = Number(entry.imageWidth) || 0;
  const ih = Number(entry.imageHeight) || 0;
  const minX = Number(box.minX) || 0;
  const minY = Number(box.minY) || 0;
  const width = Number(box.width) || 0;
  const height = Number(box.height) || 0;
  return {
    x: Math.round(minX * iw) + (region?.x ?? 0),
    y: Math.round((1 - (minY + height)) * ih) + (region?.y ?? 0),
    w: Math.round(width * iw),
    h: Math.round(height * ih),
  };
}

if (wantsCoords) {
  let entries;
  try {
    entries = lines.map((line) => JSON.parse(line));
  } catch (err) {
    console.error(
      `ERROR: could not parse --coords output from the Swift helper: ${err.message}`
    );
    process.exit(6);
  }

  const withBoxes = entries.map((entry) => ({
    text: entry.text,
    box: toPixelBox(entry),
  }));

  if (asJson) {
    console.log(JSON.stringify(withBoxes, null, 2));
  } else {
    for (const entry of withBoxes) {
      const { x, y, w, h } = entry.box;
      console.log(`${entry.text}  {x:${x},y:${y},w:${w},h:${h}}`);
    }
  }
} else if (asJson) {
  console.log(JSON.stringify({ text: lines }, null, 2));
} else {
  for (const line of lines) console.log(line);
}
