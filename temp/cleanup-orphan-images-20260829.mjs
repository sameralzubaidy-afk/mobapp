// One-off cleanup: delete unreferenced item-images storage objects.
// Reads names from the recovery snapshot table via PostgREST (service role),
// then bulk-deletes via the Storage API. Never prints the service role key.
// Ref: project drntwgporzabmxdqykrp, bucket "item-images".
import fs from 'node:fs';
import path from 'node:path';

const PROJECT_REF = 'drntwgporzabmxdqykrp';
const BASE = `https://${PROJECT_REF}.supabase.co`;
const BUCKET = 'item-images';
const SNAPSHOT_TABLE = '_orphan_image_snapshot_20260829';

// Load SUPABASE_SERVICE_ROLE_KEY from p2p-kids-marketplace/.env (never echo it).
const envPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'p2p-kids-marketplace', '.env');
const envText = fs.readFileSync(envPath, 'utf8');
const m = envText.match(/^SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?([^"'\r\n]+)["']?/m);
if (!m) {
  console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY not found in ' + envPath);
  process.exit(2);
}
const SERVICE_ROLE = m[1].trim();

async function postgrest(pathname) {
  const res = await fetch(`${BASE}/rest/v1/${pathname}`, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`postgrest ${pathname} -> ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function deleteBatch(prefixes) {
  // Try bulk delete with camelCase bucketId (supabase-js contract), then fall back to per-object DELETE.
  const res = await fetch(`${BASE}/storage/v1/object/delete`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bucketId: BUCKET, prefixes }),
  });
  const text = await res.text();
  if (res.ok) {
    let json;
    try { json = JSON.parse(text); } catch { json = text; }
    return { ok: true, body: json };
  }
  if (res.status !== 404) {
    return { ok: false, status: res.status, body: text.slice(0, 400) };
  }
  // Fallback: per-object DELETE /object/{bucket}/{path}
  let ok = 0;
  const failed = [];
  for (const p of prefixes) {
    const enc = encodeURIComponent(p);
    const r = await fetch(`${BASE}/storage/v1/object/${BUCKET}/${enc}`, {
      method: 'DELETE',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
    });
    const t = await r.text();
    if (r.ok || r.status === 400) {
      ok += 1;
    } else {
      failed.push({ path: p, status: r.status, body: t.slice(0, 200) });
    }
  }
  return { ok: true, body: { mode: 'per-object', ok, failed } };
}

async function main() {
  // 1. Pull names from the snapshot table.
  const rows = await postgrest(`${SNAPSHOT_TABLE}?select=name&limit=5000`);
  const names = rows.map((r) => r.name).filter(Boolean);
  console.log(`Loaded ${names.length} object paths from snapshot table.`);

  if (names.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  // 2. Bulk delete in batches of 50.
  const BATCH = 50;
  let ok = 0;
  const failed = [];
  let mode = 'bulk';
  for (let i = 0; i < names.length; i += BATCH) {
    const batch = names.slice(i, i + BATCH);
    const res = await deleteBatch(batch);
    if (res.ok) {
      if (typeof res.body === 'object' && res.body.mode === 'per-object') {
        mode = 'per-object';
        ok += res.body.ok;
        for (const f of res.body.failed) failed.push(f);
      } else {
        ok += batch.length;
      }
      process.stdout.write(`\rdeleted ${ok}/${names.length}`);
    } else {
      failed.push({ batchStart: i, status: res.status, body: res.body });
      console.error(`\nBatch ${i / BATCH} FAILED (${res.status}): ${res.body}`);
    }
  }
  process.stdout.write('\n');

  console.log(`\n=== SUMMARY ===`);
  console.log(`Mode: ${mode}`);
  console.log(`Successfully deleted: ${ok}`);
  console.log(`Failed: ${failed.length}`);
  if (failed.length) console.error(JSON.stringify(failed.slice(0, 5), null, 2));
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
