#!/usr/bin/env node
/**
 * qa:inspect-screen — read-only screen inspection for manual review.
 *
 * Usage:
 *   npm run qa:inspect-screen -- --img <path> [--region x,y,w,h]
 *
 *   --img <path>       screenshot file (required)
 *   --region x,y,w,h   optional region crop dump (identify + compact color
 *                      histogram quantized to 12 colors) for inspection
 *
 * Runs `magick identify` and, when --region is given, crops to /tmp/qa-inspect-*
 * and prints the crop's identify line plus a compact color histogram. Read-only;
 * no side effects outside /tmp.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const execFileP = promisify(execFile);
const args = process.argv.slice(2);

function valueOf(name) {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

function usage() {
  console.error('usage: npm run qa:inspect-screen -- --img <path> [--region x,y,w,h]');
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
if (!img) usage();
if (!existsSync(img)) {
  console.error(`ERROR: image not found: ${img}`);
  process.exit(3);
}

try {
  const { stdout } = await execFileP('magick', ['identify', img]);
  console.log(stdout.trimEnd());
} catch (err) {
  console.error(`ERROR: ImageMagick identify failed: ${err.stderr?.trim() || err.message}`);
  process.exit(4);
}

if (region) {
  const crop = join(tmpdir(), `qa-inspect-${randomBytes(6).toString('hex')}.png`);
  try {
    await execFileP('magick', [
      img,
      '-crop',
      `${region.w}x${region.h}+${region.x}+${region.y}`,
      '+repage',
      crop,
    ]);
    const { stdout } = await execFileP('magick', ['identify', crop]);
    console.log(`--- region ${region.x},${region.y} ${region.w}x${region.h} ---`);
    console.log(stdout.trimEnd());
    const hist = await execFileP('magick', [crop, '-colors', '12', '-format', '%c', 'histogram:info:-']);
    console.log('--- region color histogram (quantized to 12 colors) ---');
    console.log(hist.stdout.trimEnd());
  } catch (err) {
    console.error(`ERROR: region crop/histogram failed: ${err.stderr?.trim() || err.message}`);
    process.exit(5);
  }
}
