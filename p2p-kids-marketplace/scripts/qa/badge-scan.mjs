#!/usr/bin/env node
/**
 * qa:badge-scan — pixel/color scan of a screenshot region for badge tokens.
 *
 * Usage:
 *   npm run qa:badge-scan -- --img <path> --region x,y,w,h \
 *     --token name=SP100,rmin=250,rmax=255,gmin=235,gmax=252,bmin=180,bmax=215 \
 *     [--token name=SP500,rmin=...,...]  (repeatable)
 *
 *   --img <path>       screenshot file (required)
 *   --region x,y,w,h   scan region (required; x,y top-left origin)
 *   --token <def>      one or more token defs: name=<label>,rmin/rmax/gmin/gmax/
 *                      bmin/bmax are inclusive 0-255 channel bounds
 *
 * The region is cropped with ImageMagick into /tmp/qa-badge-* and its pixels
 * are dumped as `txt:`; the color-bucket counting (previously inline `awk`)
 * happens here in Node. Prints per-token pixel counts to stdout.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createReadStream, existsSync, unlinkSync } from 'node:fs';
import { createInterface } from 'node:readline';
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
    'usage: npm run qa:badge-scan -- --img <path> --region x,y,w,h --token name=SP100,rmin=250,rmax=255,gmin=235,gmax=252,bmin=180,bmax=215 [--token ...]\n' +
      '  --img <path>      screenshot file (required)\n' +
      '  --region x,y,w,h  scan region (required)\n' +
      '  --token <def>     one or more token defs: name=...,rmin=..,rmax=..,gmin=..,gmax=..,bmin=..,bmax=..\n' +
      '                    the name may also LEAD without the key: SP100,rmin=...,... (Dev Task 44 item 4)'
  );
  process.exit(2);
}

function parseRegion(spec) {
  const m = /^(\d+),(\d+),(\d+),(\d+)$/.exec(String(spec ?? '').trim());
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

function parseToken(def) {
  const tok = { name: undefined, rmin: NaN, rmax: NaN, gmin: NaN, gmax: NaN, bmin: NaN, bmax: NaN };
  const parts = String(def).split(',');
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    const eq = part.indexOf('=');
    if (eq === -1) {
      // Bare-color-name fallback (Dev Task 44 item 4): a part with no '=' is
      // accepted as the token's NAME when it is the FIRST part (e.g.
      // `SP100,rmin=250,...`). A bare part anywhere else is genuinely malformed.
      if (i === 0 && !tok.name) {
        tok.name = part;
        continue;
      }
      throw new Error(
        `token part has no '=': '${part}' — expected key=value (or a bare name as the FIRST part, e.g. 'SP100,rmin=250,rmax=255,...')`
      );
    }
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k === 'name') {
      tok.name = v;
    } else if (Object.prototype.hasOwnProperty.call(tok, k)) {
      tok[k] = Number(v);
    } else {
      throw new Error(`unknown token key '${k}' (expected name/rmin/rmax/gmin/gmax/bmin/bmax)`);
    }
  }
  const keys = ['rmin', 'rmax', 'gmin', 'gmax', 'bmin', 'bmax'];
  if (!tok.name || keys.some((k) => !Number.isFinite(tok[k]))) {
    throw new Error(
      `token def must include a name and all of ${keys.join('/')}; use name=<label> or lead with the bare name, e.g. 'SP100,rmin=250,rmax=255,gmin=235,gmax=252,bmin=180,bmax=215'`
    );
  }
  if (tok.rmin > tok.rmax || tok.gmin > tok.gmax || tok.bmin > tok.bmax) {
    throw new Error(`token '${tok.name}': min > max in at least one channel`);
  }
  return tok;
}

const img = valueOf('--img');
const region = parseRegion(valueOf('--region'));
const tokens = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--token') {
    const def = args[i + 1];
    if (!def) {
      console.error('missing value for --token');
      usage();
    }
    try {
      tokens.push(parseToken(def));
    } catch (err) {
      console.error(`ERROR: ${err.message}`);
      usage();
    }
  }
}

if (!img) usage();
if (tokens.length === 0) usage();
if (!existsSync(img)) {
  console.error(`ERROR: image not found: ${img}`);
  process.exit(3);
}

// Crop the region with ImageMagick into /tmp.
const crop = join(tmpdir(), `qa-badge-${randomBytes(6).toString('hex')}.png`);
try {
  await execFileP('magick', [
    img,
    '-crop',
    `${region.w}x${region.h}+${region.x}+${region.y}`,
    '+repage',
    crop,
  ]);
} catch (err) {
  console.error(`ERROR: ImageMagick crop failed: ${err.stderr?.trim() || err.message}`);
  process.exit(4);
}

// Dump pixels to a txt FILE, then stream-parse it line by line. Writing to a
// file (instead of `txt:-` to stdout) avoids execFile's maxBuffer limit on
// larger regions, and streaming keeps memory flat.
const txtPath = join(tmpdir(), `qa-badge-${randomBytes(6).toString('hex')}.txt`);
try {
  await execFileP('magick', [crop, '-depth', '8', `txt:${txtPath}`]);
} catch (err) {
  console.error(`ERROR: ImageMagick txt dump failed: ${err.stderr?.trim() || err.message}`);
  process.exit(5);
}

const counts = Object.fromEntries(tokens.map((t) => [t.name, 0]));
const lineRe = /^\s*\d+,\d+:\s*\(\s*(\d+),\s*(\d+),\s*(\d+)/;
const rl = createInterface({ input: createReadStream(txtPath), crlfDelay: Infinity });
for await (const line of rl) {
  const m = lineRe.exec(line);
  if (!m) continue;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  for (const t of tokens) {
    if (r >= t.rmin && r <= t.rmax && g >= t.gmin && g <= t.gmax && b >= t.bmin && b <= t.bmax) {
      counts[t.name] += 1;
    }
  }
}
unlinkSync(txtPath);

const total = region.w * region.h;
console.log(`region pixels: ${total}`);
for (const t of tokens) {
  const pct = total > 0 ? ((counts[t.name] / total) * 100).toFixed(2) : '0.00';
  console.log(`${t.name} pixels: ${counts[t.name]} (${pct}% of region)`);
}
