# CDN Setup: Dev Worker & Domain Migration

## Current Setup (Months 1–4): Dev Worker

### Dev Worker URL

All CDN image requests currently route through the Cloudflare Worker:

```
https://p2p-kids-cf-worker-dev.samer-alzubaidy.workers.dev
```

This worker proxies requests to Supabase Storage and caches responses at the edge.

### Configuration

Update your `.env.local` files:

**Mobile App** (`p2p-kids-marketplace/.env.local`):
```bash
EXPO_PUBLIC_CDN_URL=https://p2p-kids-cf-worker-dev.samer-alzubaidy.workers.dev
```

**Admin Panel** (`p2p-kids-admin/.env.local`):
```bash
NEXT_PUBLIC_CDN_URL=https://p2p-kids-cf-worker-dev.samer-alzubaidy.workers.dev
```

### How the Dev Worker Works

1. **Request:** `GET https://p2p-kids-cf-worker-dev.samer-alzubaidy.workers.dev/storage/v1/object/public/item-images/user-123/abc.jpg`
2. **Worker:** Routes to Supabase Storage origin: `https://drntwgporzabmxdqykrp.supabase.co/storage/v1/object/public/item-images/user-123/abc.jpg`
3. **Cache:** Worker caches response at Cloudflare edge for 30 days
4. **Response:** Returns cached or fresh image with `CF-Cache-Status` header

### Testing the Dev Worker

```bash
# 1. Upload an image via admin panel (note the public URL)
# 2. Request via dev worker URL
curl -I https://p2p-kids-cf-worker-dev.samer-alzubaidy.workers.dev/storage/v1/object/public/item-images/test.jpg

# Should see headers:
# CF-Cache-Status: MISS (first request)
# CF-Cache-Status: HIT (subsequent requests)
# CF-Ray: <cloudflare-ray-id>
```

## Domain Migration Plan (Month 4)

When your domain is available:

### Step 1: Cloudflare Setup (Manual)

1. **Purchase domain** from registrar (Namecheap, GoDaddy, etc.)
2. **Add domain to Cloudflare:**
   - Go to https://dash.cloudflare.com
   - Click "Add a site"
   - Enter your domain (e.g., `p2pkidsmarketplace.com`)
   - Select **Free plan**
   - Cloudflare scans DNS records
3. **Update registrar nameservers:**
   - Copy Cloudflare nameservers from setup screen
   - Go to your registrar's DNS settings
   - Replace with Cloudflare nameservers
   - Wait 5–60 minutes for DNS propagation
4. **Verify DNS:**
   ```bash
   dig your-domain.com
   # Should show Cloudflare nameservers
   ```

### Step 2: DNS Records (Manual)

Add these DNS records in Cloudflare dashboard:

**Admin Panel (Vercel):**
- Type: `CNAME`
- Name: `admin`
- Target: `cname.vercel-dns.com`
- Proxy: Proxied (orange cloud)
- TTL: Auto

**API (Optional - for Supabase custom domain):**
- Type: `CNAME`
- Name: `api`
- Target: `your-project.supabase.co`
- Proxy: Proxied
- TTL: Auto

**Root Domain (Optional - redirect to admin):**
- Type: `A`
- Name: `@` (root)
- IPv4: `76.76.21.21` (Vercel)
- Proxy: Proxied
- TTL: Auto

### Step 3: SSL/TLS Configuration (Manual)

In Cloudflare dashboard:

1. **Go to:** SSL/TLS → Overview
2. **Set encryption mode:** Full (strict)
3. **Go to:** SSL/TLS → Edge Certificates
4. **Enable:**
   - Always Use HTTPS: ON
   - HTTP Strict Transport Security (HSTS): ON
   - Minimum TLS Version: TLS 1.2
   - Automatic HTTPS Rewrites: ON

### Step 4: Page Rules & Caching (Manual or Automated)

Create Page Rules for image caching:

**Rule 1: Supabase Storage Images**
- URL: `https://drntwgporzabmxdqykrp.supabase.co/storage/v1/object/public/*`
- Cache Level: Cache Everything
- Edge Cache TTL: 30 days (2592000 sec)
- Browser Cache TTL: 1 day

**Rule 2: Custom Domain Images (optional)**
- URL: `https://your-domain.com/images/*`
- Cache Level: Cache Everything
- Edge Cache TTL: 30 days
- Browser Cache TTL: 1 week

**Automation Script:** `scripts/cloudflare/create_page_and_transform_rules.sh` (not yet implemented)

### Step 5: Environment Variables Update (Code)

Update `.env.local.example` and CI configs:

**Mobile:**
```bash
EXPO_PUBLIC_CDN_URL=https://admin.your-domain.com
```

**Admin:**
```bash
NEXT_PUBLIC_CDN_URL=https://admin.your-domain.com
```

**Update GitHub Actions:** Set `CF_ZONE_ID` secret for your new domain.

### Step 6: Validation

```bash
# 1. Test DNS propagation
dig admin.your-domain.com
# Should return Vercel IP

# 2. Test HTTPS
curl -I https://admin.your-domain.com
# Should show 200 OK + SSL cert

# 3. Test image caching
curl -I https://p2p-kids-cf-worker-dev.samer-alzubaidy.workers.dev/storage/v1/object/public/item-images/test.jpg
# Should show CF-Cache-Status: HIT

# 4. Update upload URL in code
# Change all cdnUrl generation to use admin.your-domain.com
```

## GitHub Secrets Setup

### For CI/CD Deployment

Set these in your GitHub repository settings (Settings → Secrets and variables → Actions):

```bash
CF_ACCOUNT_ID               # Cloudflare Account ID
CF_API_TOKEN               # Cloudflare API Token (with purge_cache scope)
CF_ZONE_ID                 # Cloudflare Zone ID (your domain's zone)
SUPABASE_SERVICE_ROLE_KEY  # Supabase service role key (for server operations)
SUPABASE_PURGE_X_API_KEY   # API key for cache purge endpoint
```

### Using CLI to Set Secrets

```bash
# Clone the repo first
cd /path/to/kids_marketplace_app

# Set secrets for mobapp repo
gh secret set CF_ACCOUNT_ID -b "your-account-id" --repo sameralzubaidy-afk/mobapp
gh secret set CF_API_TOKEN -b "your-api-token" --repo sameralzubaidy-afk/mobapp
gh secret set CF_ZONE_ID -b "your-zone-id" --repo sameralzubaidy-afk/mobapp
gh secret set SUPABASE_SERVICE_ROLE_KEY -b "your-service-role-key" --repo sameralzubaidy-afk/mobapp
gh secret set SUPABASE_PURGE_X_API_KEY -b "your-purge-api-key" --repo sameralzubaidy-afk/mobapp

# Set secrets for mobappadmin repo
gh secret set CF_ACCOUNT_ID -b "your-account-id" --repo sameralzubaidy-afk/mobappadmin
gh secret set CF_API_TOKEN -b "your-api-token" --repo sameralzubaidy-afk/mobappadmin
gh secret set CF_ZONE_ID -b "your-zone-id" --repo sameralzubaidy-afk/mobappadmin
gh secret set SUPABASE_SERVICE_ROLE_KEY -b "your-service-role-key" --repo sameralzubaidy-afk/mobappadmin
gh secret set SUPABASE_PURGE_X_API_KEY -b "your-purge-api-key" --repo sameralzubaidy-afk/mobappadmin
```

## Troubleshooting

### Issue: Cache hits not happening

**Symptoms:** `CF-Cache-Status: MISS` on every request

**Causes & Fixes:**
1. **Worker not deployed:** Verify at https://dash.cloudflare.com/workers
2. **Cache headers missing:** Check worker sets `Cache-Control: public, max-age=2592000`
3. **URL mismatch:** Ensure image URL matches worker URL pattern
4. **RLS blocking:** Check Supabase RLS policies allow public read

**Test:**
```bash
curl -v https://p2p-kids-cf-worker-dev.samer-alzubaidy.workers.dev/storage/v1/object/public/item-images/test.jpg 2>&1 | grep -i cache
```

### Issue: Purge not working in CI

**Symptoms:** Cache purge fails in GitHub Actions workflow

**Causes & Fixes:**
1. **Missing secrets:** Verify `CF_API_TOKEN`, `CF_ZONE_ID` set in repo settings
2. **Invalid token:** Cloudflare token must have `zone.cache_purge` scope
3. **Wrong zone ID:** Verify zone ID matches your domain

**Debug:**
```bash
# Test secrets locally (don't echo real values!)
echo $CF_API_TOKEN | wc -c  # Should be > 10 chars
echo $CF_ZONE_ID | wc -c    # Should be 32 chars
```

## Environment Variables Reference

### Mobile App (`p2p-kids-marketplace`)

```bash
# Development
EXPO_PUBLIC_CDN_URL=https://p2p-kids-cf-worker-dev.samer-alzubaidy.workers.dev
EXPO_PUBLIC_SUPABASE_URL=https://drntwgporzabmxdqykrp.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# Production (after domain ready)
EXPO_PUBLIC_CDN_URL=https://admin.your-domain.com
```

### Admin Panel (`p2p-kids-admin`)

```bash
# Development & Production
NEXT_PUBLIC_SUPABASE_URL=https://drntwgporzabmxdqykrp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

NEXT_PUBLIC_CDN_URL=https://p2p-kids-cf-worker-dev.samer-alzubaidy.workers.dev
SUPABASE_PURGE_ENDPOINT=https://drntwgporzabmxdqykrp.supabase.co/functions/v1/purge-cache
SUPABASE_PURGE_X_API_KEY=<your-purge-api-key>
```

### Supabase Edge Function

Set in Supabase dashboard (Functions → purge-cache → Configuration):

```bash
CF_API_TOKEN=<cloudflare-api-token>
CF_ZONE_ID=<cloudflare-zone-id>
SUPABASE_PURGE_X_API_KEY=<your-purge-api-key>
```

## Timeline

| Month | Task | Status |
|-------|------|--------|
| Now   | Dev worker + admin auth | ✅ Done |
| Now   | CI/CD + GitHub secrets | ⏳ In progress |
| Now   | Wire delete flows + tests | ⏳ Planned |
| +4mo  | Domain purchase | ⏳ Planned |
| +4mo  | Add to Cloudflare + DNS | ⏳ Planned |
| +4mo  | Page rules + caching | ⏳ Planned |
| +4mo  | Update env vars + validate | ⏳ Planned |
