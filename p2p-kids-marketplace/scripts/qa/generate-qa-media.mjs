/**
 * File: p2p-kids-marketplace/scripts/qa/generate-qa-media.mjs
 *
 * FIX-Task-24 item 3 (2026-09-12) — generate the committed QA photo fixture set at
 * `assets/qa-media/`.
 *
 * WHY THIS EXISTS
 *   `scripts/qa/android-seed-media.sh` needs a source directory of REAL image files
 *   to push into the emulator's gallery. Before this, `assets/qa-media/` did not
 *   exist, so the script silently fell back to `assets/` (app icons and the splash
 *   image) — which meant the "photos" the picker showed were app branding, not
 *   photos, and the fallback was invisible in the output.
 *
 *   The repo contains no JPEGs at all and has no image library (`sharp`/`jimp` are
 *   not dependencies), so this script writes valid PNGs with Node's built-in `zlib`
 *   and a ~30-line PNG encoder. Running it is deterministic: the same bytes are
 *   produced every time, so the committed assets can be regenerated and verified.
 *
 *   Images are deliberately DISTINCT (different palettes + patterns) because the app
 *   de-duplicates picked photos by content hash (`src/utils/photoHash.ts`) — six
 *   identical files would collapse into one selected photo.
 *
 * NOT REPRESENTATIVE PHOTOGRAPHY — these are picker-visible fixture media (colour
 * gradients, a checkerboard, rings). They exist so multi-photo flows can be driven.
 * Do NOT write assertions about image CONTENT (e.g. AI-analysis limbs) against them.
 *
 * USAGE (from p2p-kids-marketplace/)
 *   node scripts/qa/generate-qa-media.mjs            # writes assets/qa-media/*.png
 *   node scripts/qa/generate-qa-media.mjs --check    # verify committed files match
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', '..', 'assets', 'qa-media');

const CHECK_ONLY = process.argv.includes('--check');
const SIZE = 720;

// ── Minimal PNG writer (truecolor RGB, 8-bit, no interlace) ──────────────────

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

/**
 * @param {number} width
 * @param {number} height
 * @param {(x: number, y: number) => [number, number, number]} pixel
 */
function encodePng(width, height, pixel) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0; // filter type 0 (None) per scanline
    offset += 1;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixel(x, y);
      raw[offset] = r & 0xff;
      raw[offset + 1] = g & 0xff;
      raw[offset + 2] = b & 0xff;
      offset += 3;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
const mix = (a, b, t) => [clamp(a[0] + (b[0] - a[0]) * t), clamp(a[1] + (b[1] - a[1]) * t), clamp(a[2] + (b[2] - a[2]) * t)];
const lerp = (a, b, t) => a + (b - a) * t;

// ── The fixture set: name -> pixel function ─────────────────────────────────

const FIXTURES = {
  'qa-photo-01-sunset.png': (x, y) => {
    const t = (x / SIZE + y / SIZE) / 2;
    return mix([255, 138, 61], [255, 214, 102], t);
  },
  'qa-photo-02-ocean.png': (x, y) => {
    // vertical blue->teal gradient with a soft white disc
    const base = mix([38, 92, 178], [86, 205, 199], y / SIZE);
    const dx = x - SIZE * 0.68;
    const dy = y - SIZE * 0.3;
    const d = Math.sqrt(dx * dx + dy * dy);
    const disc = d < SIZE * 0.12 ? 1 : 0;
    return disc ? mix(base, [255, 255, 255], 0.85) : base;
  },
  'qa-photo-03-meadow.png': (x, y) => {
    const base = mix([76, 175, 80], [174, 213, 129], y / SIZE);
    return Math.floor(x / 60) % 2 === 0 ? mix(base, [255, 255, 255], 0.08) : base;
  },
  'qa-photo-04-berry.png': (x, y) => {
    const t = y / SIZE;
    return mix([123, 63, 160], [233, 92, 152], t);
  },
  'qa-photo-05-checker.png': (x, y) => {
    const on = (Math.floor(x / 90) + Math.floor(y / 90)) % 2 === 0;
    const base = on ? [238, 238, 238] : [96, 96, 96];
    const inAccent = x > SIZE * 0.55 && y > SIZE * 0.55;
    return inAccent ? mix(base, [93, 187, 142], 0.9) : base;
  },
  'qa-photo-06-rings.png': (x, y) => {
    const dx = x - SIZE / 2;
    const dy = y - SIZE / 2;
    const r = Math.sqrt(dx * dx + dy * dy);
    const band = Math.floor(r / 42) % 2 === 0;
    const base = mix([222, 74, 58], [250, 199, 74], lerp(0, 1, r / (SIZE / 2)));
    return band ? base : mix(base, [255, 255, 255], 0.55);
  },
};

// ── Run ─────────────────────────────────────────────────────────────────────

if (!CHECK_ONLY) {
  mkdirSync(OUT_DIR, { recursive: true });
}

let written = 0;
let mismatched = 0;

for (const [name, pixel] of Object.entries(FIXTURES)) {
  const target = resolve(OUT_DIR, name);
  const png = encodePng(SIZE, SIZE, pixel);

  if (CHECK_ONLY) {
    if (!existsSync(target)) {
      console.error(`✗ missing: assets/qa-media/${name}`);
      mismatched += 1;
    } else if (!readFileSync(target).equals(png)) {
      console.error(`✗ differs from generator output: assets/qa-media/${name}`);
      mismatched += 1;
    } else {
      console.log(`✓ ${name} (${png.length} bytes)`);
    }
    continue;
  }

  writeFileSync(target, png);
  written += 1;
  console.log(`✓ wrote assets/qa-media/${name} (${png.length} bytes)`);
}

if (CHECK_ONLY) {
  if (mismatched > 0) {
    console.error(`\n✗ ${mismatched} file(s) missing or out of date — re-run without --check.`);
    process.exit(2);
  }
  console.log('\n✓ assets/qa-media is in sync with the generator.');
} else {
  console.log(`\n✓ ${written} QA photo fixture(s) written to assets/qa-media/`);
  console.log('  NOT representative photography — picker-visible fixtures only.');
}
