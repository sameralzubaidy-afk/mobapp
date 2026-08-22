#!/usr/bin/env node
/**
 * qa:ocr — macOS Vision OCR on a screenshot, or a cropped region of one.
 *
 * Usage:
 *   npm run qa:ocr -- --img <path> [--region x,y,w,h] [--json]
 *
 *   --img <path>       screenshot file to OCR (required)
 *   --region x,y,w,h   crop region before OCR (optional; x,y top-left origin)
 *   --json             emit structured { text: string[] } instead of plain lines
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
    'usage: npm run qa:ocr -- --img <path> [--region x,y,w,h] [--json]\n' +
      '  --img <path>       screenshot file to OCR (required)\n' +
      '  --region x,y,w,h   crop region before OCR (optional)\n' +
      '  --json             emit { text: string[] } JSON instead of plain lines'
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
  ({ stdout } = await execFileP('swift', [SWIFT_SCRIPT, target]));
} catch (err) {
  console.error(`ERROR: swift OCR failed: ${err.stderr?.trim() || err.message}`);
  process.exit(5);
}

const lines = stdout.split('\n').filter((line) => line.length > 0);
if (asJson) {
  console.log(JSON.stringify({ text: lines }, null, 2));
} else {
  for (const line of lines) console.log(line);
}
