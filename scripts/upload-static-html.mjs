// Upload Supabase Storage HTML files with correct Content-Type
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/upload-static-html.mjs

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Dynamically import @supabase/supabase-js
let createClient;
try {
  const supabaseModule = await import('@supabase/supabase-js');
  createClient = supabaseModule.createClient;
} catch (err) {
  console.error('[upload-static-html] FAILED: @supabase/supabase-js not installed');
  console.error('Run: npm install @supabase/supabase-js');
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[upload-static-html] Missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const bucketName = 'static';
const files = [
  {
    local: path.join(rootDir, 'supabase/storage/stripe-redirect.html'),
    remote: 'stripe-redirect.html',
    contentType: 'text/html; charset=utf-8'
  },
  {
    local: path.join(rootDir, 'supabase/storage/stripe-redirect-refresh.html'),
    remote: 'stripe-redirect-refresh.html',
    contentType: 'text/html; charset=utf-8'
  }
];

async function ensureBucket() {
  const { data: buckets, error } = await client.storage.listBuckets();
  if (error) throw error;
  const exists = buckets?.some(b => b.name === bucketName);
  if (!exists) {
    console.log(`[upload-static-html] Creating public bucket: ${bucketName}`);
    const { error: createErr } = await client.storage.createBucket(bucketName, { public: true });
    if (createErr) {
      console.log(`[upload-static-html] Bucket may already exist, continuing...`);
    }
  } else {
    console.log(`[upload-static-html] ✅ Bucket exists: ${bucketName}`);
  }
}

async function uploadFile({ local, remote, contentType }) {
  console.log(`[upload-static-html] Uploading ${remote} (${contentType})`);
  const buffer = await fs.readFile(local);
  const { error } = await client.storage.from(bucketName).upload(remote, buffer, {
    contentType,
    upsert: true,
    cacheControl: 'no-cache'
  });
  if (error) throw error;
  console.log(`[upload-static-html] ✅ Uploaded: ${remote}`);
}

(async () => {
  try {
    await ensureBucket();
    for (const f of files) {
      await uploadFile(f);
    }
    console.log('\n[upload-static-html] ✅ SUCCESS! Test URLs:');
    for (const f of files) {
      console.log(`  ${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${f.remote}`);
    }
    process.exit(0);
  } catch (err) {
    console.error('[upload-static-html] ❌ FAILED:', err?.message || err);
    process.exit(2);
  }
})();
