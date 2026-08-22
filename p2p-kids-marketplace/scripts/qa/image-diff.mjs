#!/usr/bin/env node
/**
 * qa:image-diff — crop and compare two screenshots (or regions), print a diff
 * summary and whether they match within a threshold.
 *
 * Usage:
 *   npm run qa:image-diff -- --a <path> --b <path> [--region x,y,w,h] [--threshold 0.05]
 *
 *   --a <path>         first image (required)
 *   --b <path>         second image (required)
 *   --region x,y,w,h   crop both to this region before comparing (optional)
 *   --threshold 0.05   match when diff-pixel ratio <= threshold (default 0.05)
 *
 * Crops via ImageMagick into /tmp/qa-diff-* and compares with
 * `magick compare -metric AE` (differing-pixel count). Exit 0 on match within
 * threshold, 1 on mismatch, non-zero on real errors.
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
  console.error(
    'usage: npm run qa:image-diff -- --a <path> --b <path> [--region x,y,w,h] [--threshold 0.05]'
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

const a = valueOf('--a');
const b = valueOf('--b');
const region = parseRegion(valueOf('--region'));
const threshold = Number(valueOf('--threshold') ?? 0.05);

if (!a || !b) usage();
if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
  console.error(
    `invalid --threshold '${valueOf('--threshold')}' — must be a number in 0..1`
  );
  usage();
}
for (const [label, p] of [
  ['--a', a],
  ['--b', b],
]) {
  if (!existsSync(p)) {
    console.error(`ERROR: image not found (${label}): ${p}`);
    process.exit(3);
  }
}

const rand = randomBytes(6).toString('hex');
let fa = a;
let fb = b;
let w = 0;
let h = 0;

if (region) {
  fa = join(tmpdir(), `qa-diff-a-${rand}.png`);
  fb = join(tmpdir(), `qa-diff-b-${rand}.png`);
  try {
    await execFileP('magick', [
      a,
      '-crop',
      `${region.w}x${region.h}+${region.x}+${region.y}`,
      '+repage',
      fa,
    ]);
    await execFileP('magick', [
      b,
      '-crop',
      `${region.w}x${region.h}+${region.x}+${region.y}`,
      '+repage',
      fb,
    ]);
  } catch (err) {
    console.error(`ERROR: ImageMagick crop failed: ${err.stderr?.trim() || err.message}`);
    process.exit(4);
  }
  w = region.w;
  h = region.h;
} else {
  try {
    const { stdout } = await execFileP('magick', ['identify', '-format', '%w %h', a]);
    const [pw, ph] = stdout.trim().split(/\s+/).map(Number);
    w = pw;
    h = ph;
  } catch (err) {
    console.error(`ERROR: ImageMagick identify failed: ${err.stderr?.trim() || err.message}`);
    process.exit(5);
  }
}

// magick compare writes the AE metric to stderr; it exits 1 when images differ
// (a result, not a script error) and non-zero otherwise on genuine failures.
let metric;
try {
  const { stderr } = await execFileP('magick', ['compare', '-metric', 'AE', fa, fb, 'null:']);
  metric = stderr;
} catch (err) {
  if (err.code === 1) {
    metric = err.stderr;
  } else {
    console.error(`ERROR: ImageMagick compare failed: ${err.stderr?.trim() || err.message}`);
    process.exit(6);
  }
}

const diffPixels = Number(String(metric ?? '').trim().split(/\s+/)[0]);
if (!Number.isFinite(diffPixels)) {
  console.error(`ERROR: could not parse compare metric from: ${JSON.stringify(metric)}`);
  process.exit(7);
}

const total = w * h;
const ratio = total > 0 ? diffPixels / total : 0;
const matches = ratio <= threshold;
console.log(`diff pixels: ${diffPixels}`);
console.log(`total pixels: ${total}`);
console.log(`diff ratio: ${ratio.toFixed(4)}`);
console.log(`threshold: ${threshold}`);
console.log(`result: ${matches ? 'MATCH' : 'DIFFER'}`);
process.exit(matches ? 0 : 1);
