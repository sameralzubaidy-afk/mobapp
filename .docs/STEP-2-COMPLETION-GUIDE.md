# Step 2 Completion Guide: Merge CI Workflow & Set GitHub Secrets

## Status

✅ **COMPLETED:**
- Workflow file created: `.github/workflows/deploy-cloudflare-worker.yml`
- Changes committed and pushed to branch: `chore/add-cloudflare-deploy-workflow`
- PR ready: https://github.com/sameralzubaidy-afk/mobapp/pull/new/chore/add-cloudflare-deploy-workflow

## Remaining Actions

### 1. Create Pull Request

Option A: Use GitHub Web UI (recommended)
```bash
# Open in browser:
https://github.com/sameralzubaidy-afk/mobapp/pull/new/chore/add-cloudflare-deploy-workflow
```

Option B: Use GitHub CLI
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
gh pr create -B main -H chore/add-cloudflare-deploy-workflow \
  --title "chore: Add Cloudflare Worker CI/CD Workflow" \
  --body "Deploy worker automatically on push to main/develop branches"
```

### 2. Set Missing GitHub Secrets

**Current Status:**
- ✅ CF_ACCOUNT_ID — already set
- ✅ CF_API_TOKEN — already set
- ✅ SUPABASE_SERVICE_ROLE_KEY — already set
- ❌ CF_ZONE_ID — **NEEDS TO BE SET**
- ❌ SUPABASE_PURGE_X_API_KEY — **NEEDS TO BE SET**

#### Getting CF_ZONE_ID

1. Go to Cloudflare Dashboard: https://dash.cloudflare.com
2. Select your domain (kids-p2p-marketplace or similar)
3. Go to "Overview" tab
4. Scroll to "API" section on the right
5. Copy the **Zone ID**

#### Getting SUPABASE_PURGE_X_API_KEY

This should be the API key you set in your `.env.local` when configuring the purge endpoint.

Look for:
```
SUPABASE_PURGE_X_API_KEY=<your-api-key>
```

If you don't have it, generate a new one:
```bash
openssl rand -base64 32
```

And set it in Supabase Edge Function secrets (in `supabase/functions/purge-cache/index.ts` config).

#### Set the Secrets Using GitHub CLI

```bash
# Replace values with your actual credentials
gh secret set CF_ZONE_ID --body 'YOUR_CF_ZONE_ID' -R sameralzubaidy-afk/mobapp

gh secret set SUPABASE_PURGE_X_API_KEY --body 'YOUR_API_KEY' -R sameralzubaidy-afk/mobapp

# Also set for admin repo if applicable
gh secret set SUPABASE_PURGE_X_API_KEY --body 'YOUR_API_KEY' -R sameralzubaidy-afk/mobappadmin
```

Or use GitHub Web UI:
1. Go to: https://github.com/sameralzubaidy-afk/mobapp/settings/secrets/actions
2. Click "New repository secret"
3. Add:
   - Name: `CF_ZONE_ID`, Value: `<your-zone-id>`
   - Name: `SUPABASE_PURGE_X_API_KEY`, Value: `<your-api-key>`

### 3. Verify Secrets Are Set

```bash
# List all secrets
gh secret list -R sameralzubaidy-afk/mobapp
```

Expected output:
```
NAME                       UPDATED
CF_ACCOUNT_ID              ...
CF_API_TOKEN               ...
CF_ZONE_ID                 ✅ (NEW)
SUPABASE_SERVICE_ROLE_KEY  ...
SUPABASE_PURGE_X_API_KEY   ✅ (NEW)
```

### 4. Test the Workflow

Once secrets are set, you can test the workflow manually:

```bash
# Trigger workflow dispatch
gh workflow run deploy-cloudflare-worker.yml -R sameralzubaidy-afk/mobapp --ref main

# Or go to GitHub UI:
# https://github.com/sameralzubaidy-afk/mobapp/actions/workflows/deploy-cloudflare-worker.yml
# Click "Run workflow" → "Run workflow"
```

Expected result:
- Workflow runs with your Cloudflare secrets
- Worker is deployed to Cloudflare (if on main) or dev (if on develop)
- Workflow logs show successful deployment

### 5. Merge to Main

Once verified, merge the PR to main:

```bash
# Option A: Use GitHub Web UI
# Go to PR and click "Merge pull request"

# Option B: Use GitHub CLI
gh pr merge chore/add-cloudflare-deploy-workflow -R sameralzubaidy-afk/mobapp --squash
```

## Verification Checklist

- [ ] PR created and opened
- [ ] CF_ZONE_ID secret set
- [ ] SUPABASE_PURGE_X_API_KEY secret set
- [ ] Secrets verified with `gh secret list`
- [ ] Workflow dispatch test triggered manually
- [ ] Workflow completed successfully
- [ ] PR merged to main
- [ ] Main branch workflow auto-runs on next push

## Next Steps (Step 3)

Once Step 2 is complete:
1. Wire server delete flows to use the purge endpoint
2. Update all delete operations in:
   - Listing deletion
   - Profile image deletion
   - Message attachments deletion
3. Test delete → purge flow end-to-end
