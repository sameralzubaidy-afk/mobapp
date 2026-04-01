# MODULE 15.5: PRODUCTION READINESS — App Store Approval & Security Hardening

**Total Tasks:** 18 (5 prerequisite + 12 production + 1 full-stack scan)  
**Estimated Time:** ~70 hours  
**Dependencies:** MODULE-01 (Infrastructure), MODULE-02/03 (Auth), MODULE-09 (SP Wallet), MODULE-13 (Safety)  
**Goal:** Achieve **9+ production readiness score**, zero security gaps, pass Apple App Store & Google Play review gates.

> **⚠️ PREREQUISITE TASKS (PROD-P001 → P005)** must be completed BEFORE PROD-001. These are **App Store rejection blockers** — the app will not be accepted without them.

---

### Agent-Optimized Prompt Template (Claude Sonnet 4.5)

Add this preamble to each AI prompt block when running in Claude Sonnet 4.5 mode. It guides the agent to reason, verify, and produce tests alongside code.

```text
@agent: claude-sonnet-4.5
@mode: extended-reasoning
@autonomy: high

AGENT INSTRUCTIONS:
1. Read the entire task before generating code.
2. Produce a short plan (3-6 steps) and list any missing dependencies.
3. Generate the requested files exactly at the `filepath` locations.
4. Create unit tests for critical logic using the project's test framework.
5. Run a self-check list: type-check, lint, and run the new tests (if environment available).
6. Add concise TODO comments where manual verification is required (secrets, environment variables, or infra setup).

VERIFICATION STEPS (agent must print results):
- TypeScript type-check: `cd p2p-kids-marketplace && npx tsc -p tsconfig.json --noEmit`
- Linting: `cd p2p-kids-marketplace && npx eslint .`
- Admin type-check: `cd p2p-kids-admin && npx tsc --noEmit`
- Admin build: `cd p2p-kids-admin && yarn build`
- Tests: `npm test -- --testPathPattern=<new tests>`

ERROR HANDLING RULES:
- If a required file/dependency is missing, stop and report exact missing paths.
- For runtime secrets (API keys), inject clear TODOs and do not attempt to store secrets in code.
- For database schema mismatches, add migration stubs and mark for manual review.

REASONING GUIDELINES:
- Provide brief chain-of-thought before producing complex SQL or security changes.
- Flag performance, security, and privacy concerns.
- For store-submission tasks, reference exact Apple/Google documentation requirements.
```

---

## Current Production Readiness Score: 6.5/10

### Blocking Issues Found (Must Fix)

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | iOS Privacy Descriptions missing from app.json | P0 | **App Store REJECTION** |
| 2 | PrivacyInfo.xcprivacy missing | P0 | **App Store REJECTION** (required since Spring 2024) |
| 3 | Service role key exposed in admin portal browser | P0 | **Full DB compromise** — attacker can read/write all data |
| 4 | No global Error Boundary | P0 | Blank screen crashes → **store review failure** |
| 5 | No crash reporting (Sentry) | P0 | Blind to production crashes → **cannot maintain quality** |
| 6 | COPPA enforcement incomplete | P0 | Kids app without full COPPA gate → **legal risk + rejection** |
| 7 | Anon RLS on sp_wallets/sp_ledger | P1 | Unauthenticated users can read/write financial data |
| 8 | admin_config publicly readable | P1 | Anyone can read internal config (fee rates, feature flags) |
| 9 | No Edge Function rate limiting | P1 | DDoS/abuse vulnerability |
| 10 | Node isolation not at RLS level | P1 | Cross-node data leakage |
| 11 | TypeScript noImplicitAny: false | P2 | Type safety holes across codebase |

### Target: 9+ Score After All Tasks Complete

---

## PREREQUISITE TASKS (must be completed before any PROD-0xx task)

These tasks close **App Store rejection blockers** and **critical security gaps**.

---

## TASK PROD-P001: iOS Privacy Descriptions + PrivacyInfo.xcprivacy (App Store Blocker)

**Duration:** 2 hours  
**Priority:** Critical (P0 — App Store will REJECT without this)  
**Dependencies:** None

### Description

The `app.json` iOS section is **missing all privacy usage descriptions**. Apple requires `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, and `NSLocationWhenInUseUsageDescription` in `Info.plist` for any app that uses camera, photos, or location. The app uses all three (image picker for listings/avatar, location for nodes).

Additionally, since **Spring 2024**, Apple requires a **PrivacyInfo.xcprivacy** privacy manifest declaring what data the app collects, what APIs it uses, and for what purpose. Without this file, the app will be rejected.

**Current state of `app.json`:**
```json
"ios": {
  "supportsTablet": true,
  "bundleIdentifier": "com.p2pkids.marketplace"
}
```

**Required state:**
- `infoPlist` with all NSUsageDescription strings
- `privacyManifests` configuration for Expo SDK 54
- Proper age rating metadata

---

### AI Prompt for Cursor (Fix iOS Privacy Descriptions)

```json
/*
TASK: Add iOS privacy descriptions and privacy manifest to app.json

CONTEXT:
- app.json is at: p2p-kids-marketplace/app.json
- Expo SDK 54 supports privacyManifests natively via app.json
- App uses: Camera (expo-image-picker), Photo Library (expo-image-picker), Location (expo-location)
- App uses: Firebase Analytics, Supabase Auth (stores auth tokens in keychain)
- This is a KIDS app — Apple will scrutinize privacy declarations extra carefully

REQUIREMENTS:
1. Add infoPlist with NSCameraUsageDescription, NSPhotoLibraryUsageDescription, NSLocationWhenInUseUsageDescription
2. Add privacyManifests configuration for required API declarations
3. Strings must be kid-friendly and clearly explain WHY the app needs each permission
4. Must declare all Required Reason APIs used (UserDefaults, file timestamp, system boot time, disk space)

==================================================
FILE: Update app.json
==================================================
*/

// filepath: p2p-kids-marketplace/app.json

{
  "expo": {
    "name": "p2p-kids-marketplace",
    "slug": "p2p-kids-marketplace",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "scheme": "p2pkidsmarketplace",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.p2pkids.marketplace",
      "infoPlist": {
        "NSCameraUsageDescription": "We need camera access so you can take photos of items you want to sell or trade.",
        "NSPhotoLibraryUsageDescription": "We need photo library access so you can choose photos of items you want to sell or trade.",
        "NSLocationWhenInUseUsageDescription": "We use your location to show items available near you in your neighborhood.",
        "NSPhotoLibraryAddUsageDescription": "We need permission to save photos to your library.",
        "ITSAppUsesNonExemptEncryption": false
      },
      "privacyManifests": {
        "NSPrivacyAccessedAPITypes": [
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults",
            "NSPrivacyAccessedAPITypeReasons": ["CA92.1"]
          },
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryFileTimestamp",
            "NSPrivacyAccessedAPITypeReasons": ["C617.1"]
          },
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryDiskSpace",
            "NSPrivacyAccessedAPITypeReasons": ["E174.1"]
          },
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategorySystemBootTime",
            "NSPrivacyAccessedAPITypeReasons": ["35F9.1"]
          }
        ],
        "NSPrivacyCollectedDataTypes": [
          {
            "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeEmailAddress",
            "NSPrivacyCollectedDataTypeLinked": true,
            "NSPrivacyCollectedDataTypeTracking": false,
            "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"]
          },
          {
            "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypePhoneNumber",
            "NSPrivacyCollectedDataTypeLinked": true,
            "NSPrivacyCollectedDataTypeTracking": false,
            "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"]
          },
          {
            "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeCoarseLocation",
            "NSPrivacyCollectedDataTypeLinked": true,
            "NSPrivacyCollectedDataTypeTracking": false,
            "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"]
          },
          {
            "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypePhotosOrVideos",
            "NSPrivacyCollectedDataTypeLinked": true,
            "NSPrivacyCollectedDataTypeTracking": false,
            "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"]
          },
          {
            "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypePurchaseHistory",
            "NSPrivacyCollectedDataTypeLinked": true,
            "NSPrivacyCollectedDataTypeTracking": false,
            "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"]
          }
        ],
        "NSPrivacyTracking": false
      }
    },
    "android": {
      "package": "com.p2pkids.marketplace",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "edgeToEdgeEnabled": true,
      "predictiveBackGestureEnabled": false,
      "permissions": [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION"
      ],
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [{ "scheme": "p2pkidsmarketplace" }],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "extra": {
      "eas": {
        "projectId": "03d46492-d1d9-486c-bdc6-025df11c0479"
      }
    },
    "owner": "samer.alzubaidy",
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "updates": {
      "url": "https://u.expo.dev/03d46492-d1d9-486c-bdc6-025df11c0479"
    }
  }
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ NSCameraUsageDescription present in infoPlist
✓ NSPhotoLibraryUsageDescription present in infoPlist
✓ NSLocationWhenInUseUsageDescription present in infoPlist
✓ NSPhotoLibraryAddUsageDescription present in infoPlist
✓ ITSAppUsesNonExemptEncryption set to false
✓ privacyManifests.NSPrivacyAccessedAPITypes declares UserDefaults, FileTimestamp, DiskSpace, SystemBootTime
✓ privacyManifests.NSPrivacyCollectedDataTypes declares email, phone, coarse location, photos, purchase history
✓ NSPrivacyTracking set to false
✓ Android permissions array includes CAMERA, STORAGE, LOCATION
✓ App builds successfully with: npx expo prebuild --platform ios --clean

==================================================
NEXT TASK
==================================================

PROD-P002: Remove service role key from admin portal browser
*/
```

---

### Output Files

1. **p2p-kids-marketplace/app.json** — Updated with iOS privacy descriptions + privacy manifest

---

### Testing Steps

1. **Verify JSON is valid:**
   - `cd p2p-kids-marketplace && node -e "JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log('Valid JSON')"`

2. **Verify privacy descriptions:**
   - `cd p2p-kids-marketplace && node -e "const c = require('./app.json'); console.log('Camera:', !!c.expo.ios.infoPlist.NSCameraUsageDescription); console.log('Photos:', !!c.expo.ios.infoPlist.NSPhotoLibraryUsageDescription); console.log('Location:', !!c.expo.ios.infoPlist.NSLocationWhenInUseUsageDescription); console.log('Privacy Manifest:', !!c.expo.ios.privacyManifests);"`

3. **Test iOS prebuild:**
   - `cd p2p-kids-marketplace && npx expo prebuild --platform ios --clean`
   - Verify `ios/p2pkidsmarketplace/Info.plist` contains all NSUsageDescription keys
   - Verify `ios/p2pkidsmarketplace/PrivacyInfo.xcprivacy` is generated

4. **Test Android build:**
   - `cd p2p-kids-marketplace && npx expo prebuild --platform android --clean`
   - Verify `android/app/src/main/AndroidManifest.xml` contains CAMERA and LOCATION permissions

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Update app.json with all privacy fields | 30 min |
| Research correct privacyManifests API type reasons | 30 min |
| Test iOS prebuild and verify Info.plist | 30 min |
| Test Android prebuild and verify manifest | 15 min |
| Verify EAS build still works | 15 min |
| **Total** | **~2 hours** |

---

## TASK PROD-P002: Remove Service Role Key from Admin Portal Browser (Critical Security Fix)

**Duration:** 4 hours  
**Priority:** Critical (P0 — Full DB compromise vulnerability)  
**Dependencies:** None

### Description

The admin portal (`p2p-kids-admin`) exposes the **Supabase service role key** to the browser via `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`. This is a **catastrophic security flaw** — anyone who opens browser DevTools can extract this key and gain **full unrestricted access** to the entire database, bypassing all RLS policies.

**Affected files:**
- `p2p-kids-admin/.env.local` — Contains `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=eyJ...`
- `p2p-kids-admin/src/app/trades/[id]/TradeActions.tsx` (line 28) — Reads `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` directly in client component
- `p2p-kids-admin/src/lib/adminReferralAnalytics.ts` (line 7) — Falls back to `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`

**Fix approach:**
1. Remove ALL `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` references
2. Move all service-role operations to **Next.js API routes** (server-side only)
3. Client components call API routes instead of using service role directly
4. Rename env var to `SUPABASE_SERVICE_ROLE_KEY` (no NEXT_PUBLIC_ prefix = server-only)

---

### AI Prompt for Cursor (Fix Service Role Key Exposure)

```typescript
/*
TASK: Remove service role key from admin portal client-side code

CONTEXT:
- Admin portal: p2p-kids-admin/ (Next.js 14, App Router)
- CRITICAL: NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY is exposed to the browser
- Any env var prefixed with NEXT_PUBLIC_ is bundled into client JavaScript
- Service role key must ONLY be used in server-side code (API routes, Server Components, middleware)
- The admin already has API routes at: p2p-kids-admin/src/app/api/admin/

AFFECTED FILES:
1. p2p-kids-admin/.env.local — has NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
2. p2p-kids-admin/src/app/trades/[id]/TradeActions.tsx — 'use client' component using service role key
3. p2p-kids-admin/src/lib/adminReferralAnalytics.ts — falls back to NEXT_PUBLIC version

FIX PLAN:
1. Create a server-side admin Supabase client utility
2. Create an API route for trade force-cancel (replaces client-side service role usage)
3. Update TradeActions.tsx to call the API route instead
4. Update adminReferralAnalytics.ts to remove NEXT_PUBLIC fallback
5. Remove NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY from .env.local
6. Add SUPABASE_SERVICE_ROLE_KEY (server-only) to .env.local

==================================================
FILE 1: Server-only admin Supabase client
==================================================
*/

// filepath: p2p-kids-admin/src/lib/supabaseAdmin.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

/**
 * Server-only Supabase client with service role key.
 * MUST ONLY be used in:
 * - API routes (src/app/api/**/route.ts)
 * - Server Components
 * - Server Actions
 *
 * NEVER import this in files marked 'use client'.
 */
export function getAdminSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing server-side Supabase config. Required env vars:\n' +
      '  SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)\n' +
      '  SUPABASE_SERVICE_ROLE_KEY (NOT NEXT_PUBLIC_)\n\n' +
      'These must be set in .env.local WITHOUT the NEXT_PUBLIC_ prefix.'
    );
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedClient;
}

/*
==================================================
FILE 2: API route for trade force-cancel
==================================================
*/

// filepath: p2p-kids-admin/src/app/api/admin/trades/force-cancel/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication
    const adminSecret = req.headers.get('x-admin-secret');
    const expectedSecret = process.env.ADMIN_UI_SECRET;

    if (!expectedSecret || adminSecret !== expectedSecret) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid admin credentials' } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { tradeId, reason, adminUserId } = body;

    if (!tradeId || !reason) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'tradeId and reason are required' } },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabaseClient();

    // Call the admin force cancel RPC
    const { data, error } = await supabase.rpc('admin_force_cancel_trade', {
      p_trade_id: tradeId,
      p_reason: reason,
      p_admin_user_id: adminUserId || null,
    });

    if (error) {
      console.error('[admin/trades/force-cancel]', { tradeId, error: error.message });
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin/trades/force-cancel] Unhandled:', message);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}

/*
==================================================
FILE 3: Updated TradeActions.tsx (NO service role key)
==================================================
*/

// filepath: p2p-kids-admin/src/app/trades/[id]/TradeActions.tsx (REPLACE)

// NOTE: This is a 'use client' component.
// It must NOT import or reference any service role key.
// Instead, it calls the server-side API route.

'use client';

import { useState } from 'react';

type Props = {
  tradeId: string;
  status: string;
};

export default function TradeActions({ tradeId, status }: Props) {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleForceCancel = async () => {
    if (!reason.trim()) {
      alert('Please provide a reason for cancellation');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/admin/trades/force-cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_UI_SECRET || '',
        },
        body: JSON.stringify({ tradeId, reason }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Force cancel failed');
      }

      setResult('Trade cancelled successfully');
      setShowCancelModal(false);
      setReason('');
      // Reload to reflect new status
      window.location.reload();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[TradeActions] Force cancel error:', message);
      alert(`Error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'cancelled' || status === 'completed') {
    return <p className="text-gray-500 text-sm">No actions available for {status} trades.</p>;
  }

  return (
    <div className="mt-4">
      {!showCancelModal ? (
        <button
          onClick={() => setShowCancelModal(true)}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          disabled={loading}
        >
          Force Cancel Trade
        </button>
      ) : (
        <div className="border border-red-300 rounded p-4 bg-red-50">
          <h4 className="font-semibold text-red-800 mb-2">Confirm Force Cancel</h4>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for cancellation (required)..."
            className="w-full border rounded p-2 mb-2"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={handleForceCancel}
              disabled={loading || !reason.trim()}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Cancelling...' : 'Confirm Cancel'}
            </button>
            <button
              onClick={() => { setShowCancelModal(false); setReason(''); }}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
              disabled={loading}
            >
              Back
            </button>
          </div>
        </div>
      )}
      {result && <p className="mt-2 text-green-600 text-sm">{result}</p>}
    </div>
  );
}

/*
==================================================
FILE 4: Update adminReferralAnalytics.ts
==================================================
*/

// filepath: p2p-kids-admin/src/lib/adminReferralAnalytics.ts (UPDATE line 7)

// CHANGE FROM:
// const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';

// CHANGE TO:
// const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// This removes the fallback to the NEXT_PUBLIC_ prefixed key.
// The file is used in server components, so SUPABASE_SERVICE_ROLE_KEY (server-only) is correct.

/*
==================================================
FILE 5: Update .env.local
==================================================
*/

// filepath: p2p-kids-admin/.env.local (UPDATE)

// REMOVE this line entirely:
// NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=eyJ...

// KEEP (or add if missing):
// SUPABASE_SERVICE_ROLE_KEY=eyJ... (same value, no NEXT_PUBLIC_ prefix)

// RENAME:
// NEXT_PUBLIC_ADMIN_UI_SECRET → keep as NEXT_PUBLIC_ because client components need it for API route auth header

// Also update .env.example and .env.staging to match

/*
==================================================
FILE 6: Update .env.example
==================================================
*/

// filepath: p2p-kids-admin/.env.example (UPDATE)

// REMOVE:
// NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

// ADD:
// SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Server-only! Never prefix with NEXT_PUBLIC_

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ ZERO occurrences of NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY in entire codebase
✓ No 'use client' file imports or references service role key
✓ TradeActions.tsx calls /api/admin/trades/force-cancel instead of using service role
✓ adminReferralAnalytics.ts uses only SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ fallback)
✓ .env.local has SUPABASE_SERVICE_ROLE_KEY (without NEXT_PUBLIC_ prefix)
✓ Admin portal builds successfully: cd p2p-kids-admin && yarn build
✓ Force-cancel still works via new API route
✓ Browser DevTools → Sources tab shows NO service role key in any JS bundle

==================================================
NEXT TASK
==================================================

PROD-P003: Global Error Boundary
*/
```

---

### Output Files

1. **p2p-kids-admin/src/lib/supabaseAdmin.ts** — Server-only admin Supabase client
2. **p2p-kids-admin/src/app/api/admin/trades/force-cancel/route.ts** — API route for trade cancellation
3. **p2p-kids-admin/src/app/trades/[id]/TradeActions.tsx** — Updated (no service role key)
4. **p2p-kids-admin/src/lib/adminReferralAnalytics.ts** — Updated (removed NEXT_PUBLIC fallback)
5. **p2p-kids-admin/.env.local** — Updated (renamed env var)
6. **p2p-kids-admin/.env.example** — Updated

---

### Testing Steps

1. **Verify no NEXT_PUBLIC service role key in codebase:**
   - `cd p2p-kids-admin && grep -r "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY" src/`
   - Expected: **zero results**

2. **Verify build succeeds:**
   - `cd p2p-kids-admin && yarn build`
   - Expected: exit code 0

3. **Verify key not in client bundle:**
   - `cd p2p-kids-admin && yarn build && grep -r "service_role" .next/static/`
   - Expected: **zero results**

4. **Test force-cancel flow:**
   - Start admin portal: `cd p2p-kids-admin && yarn dev`
   - Navigate to a trade detail page
   - Click "Force Cancel Trade" → enter reason → confirm
   - Should call `/api/admin/trades/force-cancel` and succeed

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Create supabaseAdmin.ts server utility | 20 min |
| Create force-cancel API route | 40 min |
| Update TradeActions.tsx | 30 min |
| Update adminReferralAnalytics.ts | 10 min |
| Update .env files | 15 min |
| Audit all NEXT_PUBLIC_ service role usages (may find more) | 30 min |
| Test build + verify no leaks | 30 min |
| Test force-cancel flow end-to-end | 25 min |
| **Total** | **~4 hours** |

---

## TASK PROD-P003: Global Error Boundary (App Store Requirement)

**Duration:** 2 hours  
**Priority:** Critical (P0 — Unhandled crashes cause blank screens → store rejection)  
**Dependencies:** None

### Description

The app has **no Error Boundary**. Any unhandled JavaScript error in a React component tree causes a blank white screen with no way to recover. Apple and Google reviewers will reject apps that crash to blank screens.

Create:
1. A `GlobalErrorBoundary` React class component (must be class component — React error boundaries cannot be function components)
2. A user-friendly fallback UI with "Something went wrong" message and "Try Again" button
3. Wrap the app root in `App.tsx` with the error boundary
4. Log caught errors to console (and later to Sentry in PROD-P004)

---

### AI Prompt for Cursor (Create Global Error Boundary)

```typescript
/*
TASK: Create a global Error Boundary component and wire it into the app root

CONTEXT:
- App entry point: p2p-kids-marketplace/App.tsx
- No existing ErrorBoundary anywhere in the codebase
- React Error Boundaries MUST be class components (not hooks)
- The app uses React Navigation — the boundary should wrap the entire NavigationContainer
- No Sentry yet (that's PROD-P004), so just console.error for now

REQUIREMENTS:
1. Create ErrorBoundary class component with:
   - state: hasError, error, errorInfo
   - static getDerivedStateFromError() to catch render errors
   - componentDidCatch() to log errors
   - Fallback UI with:
     - "Oops! Something went wrong" message
     - Error details (hidden by default, toggle to show in DEV mode only)
     - "Try Again" button that resets state
     - "Report Problem" button placeholder
   - Kid-friendly, non-scary design
2. Create a useErrorHandler hook for catching async errors in function components
3. Wrap app root with ErrorBoundary

==================================================
FILE 1: ErrorBoundary Component
==================================================
*/

// filepath: p2p-kids-marketplace/src/components/ErrorBoundary.tsx

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console (Sentry integration added in PROD-P004)
    console.error('[ErrorBoundary] Caught error:', error.message);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    this.setState({ errorInfo });

    // TODO(PROD-P004): Replace with Sentry.captureException(error, { extra: errorInfo })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.emoji}>😕</Text>
            <Text style={styles.title}>Oops! Something went wrong</Text>
            <Text style={styles.message}>
              {"Don't worry — your stuff is safe. Try again and it should work!"}
            </Text>

            <TouchableOpacity style={styles.primaryButton} onPress={this.handleReset}>
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </TouchableOpacity>

            {__DEV__ && (
              <>
                <TouchableOpacity
                  style={styles.detailsToggle}
                  onPress={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
                >
                  <Text style={styles.detailsToggleText}>
                    {this.state.showDetails ? 'Hide Details' : 'Show Error Details'}
                  </Text>
                </TouchableOpacity>

                {this.state.showDetails && (
                  <ScrollView style={styles.detailsBox}>
                    <Text style={styles.detailsText}>
                      {this.state.error?.toString()}
                      {'\n\n'}
                      {this.state.errorInfo?.componentStack}
                    </Text>
                  </ScrollView>
                )}
              </>
            )}
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  detailsToggle: {
    marginTop: 8,
  },
  detailsToggleText: {
    color: '#007AFF',
    fontSize: 13,
  },
  detailsBox: {
    marginTop: 12,
    maxHeight: 200,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    width: '100%',
  },
  detailsText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#c00',
  },
});

/*
==================================================
FILE 2: Update App.tsx to wrap with ErrorBoundary
==================================================
*/

// filepath: p2p-kids-marketplace/App.tsx (UPDATE)

// ADD import at top:
// import ErrorBoundary from './src/components/ErrorBoundary';

// WRAP the outermost component:
// Before: export default function App() { return <AuthProvider>...</AuthProvider>; }
// After:  export default function App() { return <ErrorBoundary><AuthProvider>...</AuthProvider></ErrorBoundary>; }

// The ErrorBoundary MUST be the outermost wrapper (above AuthProvider, NavigationContainer, etc.)
// so it catches errors from ANY component in the tree.

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ ErrorBoundary class component exists at src/components/ErrorBoundary.tsx
✓ App.tsx wraps root with <ErrorBoundary>
✓ Fallback UI shows "Oops! Something went wrong" with Try Again button
✓ Try Again resets error state and re-renders children
✓ Error details visible only in __DEV__ mode
✓ componentDidCatch logs error + component stack
✓ App still functions normally (boundary only activates on error)
✓ TypeScript compiles: cd p2p-kids-marketplace && npx tsc --noEmit

==================================================
NEXT TASK
==================================================

PROD-P004: Sentry Crash Reporting Integration
*/
```

---

### Output Files

1. **p2p-kids-marketplace/src/components/ErrorBoundary.tsx** — Global error boundary component
2. **p2p-kids-marketplace/App.tsx** — Updated with ErrorBoundary wrapper

---

### Testing Steps

1. **Verify component compiles:**
   - `cd p2p-kids-marketplace && npx tsc --noEmit`

2. **Test error boundary manually:**
   - Temporarily add a component that throws: `function CrashTest() { throw new Error('test'); }`
   - Render `<CrashTest />` inside a screen
   - Verify fallback UI appears with "Oops!" message
   - Tap "Try Again" → app recovers
   - Remove test component

3. **Verify DEV mode details:**
   - In development build, "Show Error Details" button should appear
   - Tapping it shows error message + component stack

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Create ErrorBoundary component | 40 min |
| Update App.tsx wrapper | 15 min |
| Style fallback UI | 20 min |
| Test with intentional crash | 20 min |
| Verify TypeScript compilation | 10 min |
| Test Try Again recovery | 15 min |
| **Total** | **~2 hours** |

---

## TASK PROD-P004: Sentry Crash Reporting Integration

**Duration:** 3 hours  
**Priority:** Critical (P0 — Cannot diagnose production crashes without this)  
**Dependencies:** PROD-P003 (ErrorBoundary must exist)

### Description

The app has **no crash reporting**. `SignupScreen.tsx` has commented-out Sentry code (`// TODO: Integrate Sentry`), and `@sentry/react-native` is not in `package.json`. Without crash reporting, production issues are invisible.

Install and configure Sentry for:
1. Automatic crash/exception capture
2. Integration with the ErrorBoundary from PROD-P003
3. User context (anonymized user ID, subscription tier)
4. Navigation breadcrumbs (track which screens user visited before crash)
5. Performance monitoring (optional, can be disabled for MVP)

---

### AI Prompt for Cursor (Integrate Sentry)

```typescript
/*
TASK: Install and configure Sentry crash reporting

CONTEXT:
- App root: p2p-kids-marketplace/
- ErrorBoundary at: src/components/ErrorBoundary.tsx (from PROD-P003)
- AuthContext at: src/contexts/AuthContext.tsx (provides user ID + subscription status)
- COPPA REQUIREMENT: Do NOT send PII (email, phone, name, DOB) to Sentry
  Only send: anonymized user_id, subscription_tier, node_id
- Sentry DSN must be in .env, not hardcoded

REQUIREMENTS:
1. Install @sentry/react-native
2. Create Sentry initialization module at src/services/sentry.ts
3. Update App.tsx to initialize Sentry before rendering
4. Update ErrorBoundary to call Sentry.captureException in componentDidCatch
5. Add user context (anonymized) after auth
6. Add navigation integration for breadcrumbs
7. Environment-aware: only enable in staging/production (not dev)
8. NEVER send PII (name, email, phone, DOB) — kids app COPPA rules

==================================================
FILE 1: Sentry service module
==================================================
*/

// filepath: p2p-kids-marketplace/src/services/sentry.ts

import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';
const IS_DEV = __DEV__;

/**
 * Initialize Sentry. Call once at app startup, before any rendering.
 * 
 * Environment vars needed:
 * - EXPO_PUBLIC_SENTRY_DSN: Sentry project DSN
 */
export function initSentry() {
  if (IS_DEV || !SENTRY_DSN) {
    if (!SENTRY_DSN) {
      console.warn('[Sentry] No DSN configured — crash reporting disabled');
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    // Only capture errors in staging/production
    enabled: !IS_DEV,
    // Disable performance monitoring for MVP (save bandwidth)
    tracesSampleRate: 0,
    // Attach screenshots on crash (helpful for UI bugs)
    attachScreenshot: true,
    // Don't send PII — COPPA compliance for kids app
    sendDefaultPii: false,
    // Filter out sensitive data
    beforeSend(event) {
      // Strip any email, phone, or name that might leak through
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
        delete event.user.ip_address;
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      // Don't log fetch URLs that may contain tokens
      if (breadcrumb.category === 'fetch' && breadcrumb.data?.url) {
        const url = breadcrumb.data.url as string;
        if (url.includes('token=') || url.includes('apikey=')) {
          breadcrumb.data.url = '[FILTERED]';
        }
      }
      return breadcrumb;
    },
  });
}

/**
 * Set authenticated user context for Sentry.
 * COPPA-safe: only sends anonymized ID and subscription tier.
 */
export function setSentryUser(userId: string, subscriptionTier?: string, nodeId?: string) {
  if (IS_DEV) return;

  Sentry.setUser({
    id: userId, // UUID only — no PII
  });
  if (subscriptionTier) {
    Sentry.setTag('subscription_tier', subscriptionTier);
  }
  if (nodeId) {
    Sentry.setTag('node_id', nodeId);
  }
}

/**
 * Clear user context on logout.
 */
export function clearSentryUser() {
  Sentry.setUser(null);
}

/**
 * Capture a non-fatal error with context.
 */
export function captureError(error: Error, context?: Record<string, unknown>) {
  if (IS_DEV) {
    console.error('[Sentry would capture]:', error.message, context);
    return;
  }
  Sentry.captureException(error, { extra: context });
}

/**
 * Wrap the root component with Sentry error boundary.
 */
export const SentryErrorBoundary = Sentry.wrap;

/*
==================================================
FILE 2: Update ErrorBoundary to use Sentry
==================================================
*/

// filepath: p2p-kids-marketplace/src/components/ErrorBoundary.tsx (UPDATE)

// In componentDidCatch, ADD:
// import { captureError } from '../services/sentry';
//
// componentDidCatch(error: Error, errorInfo: ErrorInfo) {
//   console.error('[ErrorBoundary] Caught error:', error.message);
//   captureError(error, { componentStack: errorInfo.componentStack });
//   this.setState({ errorInfo });
// }

/*
==================================================
FILE 3: Update App.tsx to initialize Sentry
==================================================
*/

// filepath: p2p-kids-marketplace/App.tsx (UPDATE)

// ADD at top of file (before any component code):
// import { initSentry } from './src/services/sentry';
// initSentry();

// Optionally wrap root component:
// import * as Sentry from '@sentry/react-native';
// export default Sentry.wrap(App);

/*
==================================================
FILE 4: Add EXPO_PUBLIC_SENTRY_DSN to env files
==================================================
*/

// filepath: p2p-kids-marketplace/.env.local.example (ADD)
// EXPO_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id

// filepath: p2p-kids-marketplace/.env.local (ADD)
// EXPO_PUBLIC_SENTRY_DSN=  # TODO: Get DSN from Sentry project settings

/*
==================================================
INSTALL COMMAND
==================================================

npx expo install @sentry/react-native

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ @sentry/react-native in package.json dependencies
✓ src/services/sentry.ts exists with initSentry, setSentryUser, clearSentryUser, captureError exports
✓ Sentry initialized in App.tsx before rendering
✓ ErrorBoundary calls captureError in componentDidCatch
✓ sendDefaultPii set to false (COPPA)
✓ beforeSend strips email/username/ip_address
✓ Disabled in __DEV__ mode
✓ EXPO_PUBLIC_SENTRY_DSN in .env.local.example
✓ TypeScript compiles: npx tsc --noEmit
✓ App starts without crash: npx expo start

==================================================
NEXT TASK
==================================================

PROD-P005: COPPA Compliance Enforcement
*/
```

---

### Output Files

1. **p2p-kids-marketplace/src/services/sentry.ts** — Sentry initialization + helpers
2. **p2p-kids-marketplace/src/components/ErrorBoundary.tsx** — Updated with Sentry integration
3. **p2p-kids-marketplace/App.tsx** — Updated with Sentry init
4. **p2p-kids-marketplace/.env.local.example** — Updated with SENTRY_DSN

---

### Testing Steps

1. **Install dependency:**
   - `cd p2p-kids-marketplace && npx expo install @sentry/react-native`
   - Verify `@sentry/react-native` appears in `package.json`

2. **Verify compilation:**
   - `cd p2p-kids-marketplace && npx tsc --noEmit`

3. **Verify dev mode skip:**
   - Run app in dev mode
   - Check console: should see "[Sentry] No DSN configured" warning
   - Sentry should NOT be active in dev

4. **Verify Sentry captures (staging):**
   - Set EXPO_PUBLIC_SENTRY_DSN in .env.local
   - Trigger intentional error
   - Check Sentry dashboard for the captured event
   - Verify NO PII (email, name, phone) in the event

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Install @sentry/react-native | 15 min |
| Create sentry.ts service | 40 min |
| Update ErrorBoundary | 15 min |
| Update App.tsx | 15 min |
| Update env files | 10 min |
| Test in dev mode | 20 min |
| Test with real DSN (staging) | 30 min |
| Verify COPPA compliance (no PII) | 15 min |
| **Total** | **~3 hours** |

---

## TASK PROD-P005: COPPA Compliance Server-Side Enforcement

**Duration:** 4 hours  
**Priority:** Critical (P0 — Kids app MUST enforce COPPA or face legal action + store rejection)  
**Dependencies:** MODULE-02/03 (Auth must exist), profiles table must exist

### Description

This is a kids marketplace app. **COPPA (Children's Online Privacy Protection Act)** requires:
1. **Parental consent verification** for users under 13
2. **Age gating** — block accounts for children under minimum age without parental consent
3. **Data minimization** — only collect data necessary for the app
4. **Server-side enforcement** — UI-only checks are insufficient

The app already has a `parental_consent_verified` column on profiles and a `parentalEmail` field on signup. But enforcement is **client-side only** — the server does not block actions for unverified minors. A malicious client can skip the consent screen and use the app freely.

Create server-side COPPA enforcement via:
1. A database constraint/trigger that blocks unconsented minors from creating listings or initiating trades
2. An Edge Function middleware helper that checks COPPA status
3. A parental consent verification flow (email-based)

---

### AI Prompt for Cursor (COPPA Server-Side Enforcement)

```sql
/*
TASK: Add COPPA enforcement at database level

CONTEXT:
- profiles table has: date_of_birth (date), parental_consent_verified (boolean)
- Users under 13 require parental consent before they can:
  a) Create listings
  b) Initiate trades
  c) Send messages
  d) Upload photos
- Currently: only enforced on the client (UI hides buttons) — server allows everything

REQUIREMENTS:
1. Create a helper function is_coppa_compliant(p_user_id UUID) that returns boolean
2. Add checks in listing creation and trade creation RPCs
3. Log COPPA blocks for audit

==================================================
Migration: COPPA enforcement
==================================================
*/

-- filepath: supabase/migrations/20260601000001_coppa_enforcement.sql
-- Mode: idempotent (safe to re-run)

-- STEP 1: Create COPPA compliance check function
CREATE OR REPLACE FUNCTION public.is_coppa_compliant(p_user_id UUID)
RETURNS BOOLEAN AS $$
-- SECURITY DEFINER needed: must read profiles regardless of RLS context
DECLARE
  v_dob DATE;
  v_consent BOOLEAN;
  v_age_years INTEGER;
BEGIN
  SELECT p.date_of_birth, p.parental_consent_verified
  INTO v_dob, v_consent
  FROM public.profiles p
  WHERE p.user_id = p_user_id;

  -- No profile found = not compliant
  IF v_dob IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Calculate age
  v_age_years := EXTRACT(YEAR FROM age(CURRENT_DATE, v_dob));

  -- If 13 or older, COPPA does not apply
  IF v_age_years >= 13 THEN
    RETURN TRUE;
  END IF;

  -- Under 13: must have parental consent verified
  RETURN COALESCE(v_consent, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- STEP 2: Create COPPA gate function (raises exception if not compliant)
CREATE OR REPLACE FUNCTION public.enforce_coppa(p_user_id UUID, p_action TEXT)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_coppa_compliant(p_user_id) THEN
    -- Log the blocked action for audit
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES (
      'coppa_enforcement',
      'Action blocked: ' || p_action,
      jsonb_build_object('user_id', p_user_id, 'action', p_action, 'blocked_at', NOW())
    );

    RAISE EXCEPTION 'COPPA_CONSENT_REQUIRED: Parental consent is required for users under 13 to %', p_action
      USING ERRCODE = 'P0001';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- STEP 3: Create trigger for items table (block listing creation without consent)
CREATE OR REPLACE FUNCTION public.check_coppa_before_item_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.enforce_coppa(NEW.seller_id, 'create listings');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Re-raise COPPA exceptions, log others
  IF SQLERRM LIKE 'COPPA_CONSENT_REQUIRED%' THEN
    RAISE;
  END IF;
  INSERT INTO public.debug_logs (process_name, message, payload)
  VALUES ('coppa_item_trigger', 'Unexpected error', jsonb_build_object('error', SQLERRM));
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_coppa_check_item_insert ON public.items;
CREATE TRIGGER trigger_coppa_check_item_insert
  BEFORE INSERT ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.check_coppa_before_item_insert();

-- STEP 4: Create trigger for trades table (block trade initiation without consent)
CREATE OR REPLACE FUNCTION public.check_coppa_before_trade_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.enforce_coppa(NEW.buyer_id, 'initiate trades');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'COPPA_CONSENT_REQUIRED%' THEN
    RAISE;
  END IF;
  INSERT INTO public.debug_logs (process_name, message, payload)
  VALUES ('coppa_trade_trigger', 'Unexpected error', jsonb_build_object('error', SQLERRM));
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_coppa_check_trade_insert ON public.trades;
CREATE TRIGGER trigger_coppa_check_trade_insert
  BEFORE INSERT ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.check_coppa_before_trade_insert();

/*
==================================================
VERIFICATION QUERIES (run after migration)
==================================================
*/

-- Verify functions exist
-- SELECT proname FROM pg_proc WHERE proname IN ('is_coppa_compliant', 'enforce_coppa', 'check_coppa_before_item_insert', 'check_coppa_before_trade_insert');

-- Verify triggers exist
-- SELECT trigger_name, event_object_table, event_manipulation
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public' AND trigger_name LIKE 'trigger_coppa%';

-- Test with a user over 13 (should return TRUE)
-- SELECT public.is_coppa_compliant('some-uuid-of-adult-user');

-- Test with an unconsented minor (should return FALSE)
-- SELECT public.is_coppa_compliant('some-uuid-of-minor-without-consent');

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ is_coppa_compliant function returns TRUE for users >= 13
✓ is_coppa_compliant function returns TRUE for users < 13 WITH parental_consent_verified = true
✓ is_coppa_compliant function returns FALSE for users < 13 WITHOUT parental consent
✓ enforce_coppa raises exception with COPPA_CONSENT_REQUIRED message
✓ Listing creation blocked for unconsented minors (trigger fires)
✓ Trade initiation blocked for unconsented minors (trigger fires)
✓ COPPA blocks logged in debug_logs for audit
✓ Users >= 13 are not affected (no false positives)

==================================================
NEXT TASK
==================================================

PROD-001: Remove anon RLS policies from sp_wallets/sp_ledger
*/
```

---

### Output Files

1. **supabase/migrations/20260601000001_coppa_enforcement.sql** — COPPA functions + triggers

---

### Testing Steps

1. **Run migration:**
   - Execute in Supabase SQL Editor
   - Verify functions and triggers appear

2. **Test COPPA check:** 
   ```sql
   -- Create test minor profile (age 10, no consent)
   -- INSERT INTO profiles (user_id, date_of_birth, parental_consent_verified)
   -- VALUES ('test-uuid', '2015-01-01', false);
   -- SELECT public.is_coppa_compliant('test-uuid'); -- Should return FALSE
   
   -- Grant consent
   -- UPDATE profiles SET parental_consent_verified = true WHERE user_id = 'test-uuid';
   -- SELECT public.is_coppa_compliant('test-uuid'); -- Should return TRUE
   ```

3. **Test listing block:**
   - Attempt INSERT into items with seller_id of unconsented minor
   - Should raise `COPPA_CONSENT_REQUIRED` exception

4. **Test trade block:**
   - Attempt INSERT into trades with buyer_id of unconsented minor
   - Should raise `COPPA_CONSENT_REQUIRED` exception

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Write COPPA functions | 45 min |
| Write triggers for items/trades | 30 min |
| Test with sample data | 30 min |
| Verify audit logging works | 20 min |
| Update Edge Functions to handle COPPA_CONSENT_REQUIRED error | 45 min |
| Test end-to-end (minor tries to create listing) | 30 min |
| **Total** | **~4 hours** |

---

---

## MAIN TASKS (PROD-001 → PROD-012)

---

## TASK PROD-001: Remove Anon RLS Policies from sp_wallets / sp_ledger (Security Fix)

**Duration:** 2 hours  
**Priority:** High (P1 — Unauthenticated users can read/write financial data)  
**Dependencies:** PROD-P005 (COPPA enforcement does not depend on this, but both touch RLS)

### Description

Migration `20260205000003_ultimate_test_alignment_fix.sql` added **anon insert/update/select policies** to `sp_wallets` for testing purposes. These were never removed and are currently active in production. This means **any unauthenticated user** can read wallet balances, insert fake wallets, and modify balances.

**Current dangerous policies:**
```sql
CREATE POLICY "sp_wallets_anon_insert" ON sp_wallets FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "sp_wallets_anon_update" ON sp_wallets FOR UPDATE TO anon USING (true);
CREATE POLICY "sp_wallets_anon_select" ON sp_wallets FOR SELECT TO anon USING (true);
```

These must be **dropped immediately** and replaced with authenticated-only policies.

---

### AI Prompt for Cursor (Fix sp_wallets/sp_ledger RLS)

```sql
/*
TASK: Remove dangerous anon RLS policies from sp_wallets and sp_ledger

CONTEXT:
- sp_wallets table has anon INSERT/UPDATE/SELECT policies from a test migration
- sp_ledger may also have overly permissive policies
- These allow unauthenticated users to read/write financial data
- Must replace with authenticated-only policies scoped to user_id

REQUIREMENTS:
1. Drop ALL anon policies on sp_wallets
2. Drop ALL anon policies on sp_ledger
3. Ensure authenticated users can only access their own wallet/ledger
4. Service role maintains full access (for admin/webhooks)
5. Include verification queries

==================================================
Migration: Fix sp_wallets and sp_ledger RLS
==================================================
*/

-- filepath: supabase/migrations/20260601000002_fix_sp_wallet_rls_security.sql
-- Mode: idempotent (safe to re-run)

-- ============================================
-- BLOCK 1: Drop dangerous policies
-- ============================================

-- sp_wallets: Remove anon policies
DROP POLICY IF EXISTS "sp_wallets_anon_insert" ON public.sp_wallets;
DROP POLICY IF EXISTS "sp_wallets_anon_update" ON public.sp_wallets;
DROP POLICY IF EXISTS "sp_wallets_anon_select" ON public.sp_wallets;
DROP POLICY IF EXISTS "sp_wallets_anon_delete" ON public.sp_wallets;

-- sp_ledger: Remove anon policies (if any exist)
DROP POLICY IF EXISTS "sp_ledger_anon_insert" ON public.sp_ledger;
DROP POLICY IF EXISTS "sp_ledger_anon_update" ON public.sp_ledger;
DROP POLICY IF EXISTS "sp_ledger_anon_select" ON public.sp_ledger;
DROP POLICY IF EXISTS "sp_ledger_anon_delete" ON public.sp_ledger;

-- Ensure RLS is enabled
ALTER TABLE public.sp_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sp_ledger ENABLE ROW LEVEL SECURITY;

-- ============================================
-- BLOCK 2: Create correct policies
-- ============================================

-- sp_wallets: Users can read ONLY their own wallet
DROP POLICY IF EXISTS "sp_wallets_select_own" ON public.sp_wallets;
CREATE POLICY "sp_wallets_select_own" ON public.sp_wallets
  FOR SELECT TO authenticated
  USING (sp_wallets.user_id = auth.uid());

-- sp_wallets: Only service_role/RPC functions can insert/update (not direct client)
DROP POLICY IF EXISTS "sp_wallets_service_role_all" ON public.sp_wallets;
CREATE POLICY "sp_wallets_service_role_all" ON public.sp_wallets
  FOR ALL TO service_role
  USING (true);

-- sp_ledger: Users can read ONLY their own ledger entries
DROP POLICY IF EXISTS "sp_ledger_select_own" ON public.sp_ledger;
CREATE POLICY "sp_ledger_select_own" ON public.sp_ledger
  FOR SELECT TO authenticated
  USING (sp_ledger.user_id = auth.uid());

-- sp_ledger: Only service_role/RPC functions can insert (append-only ledger)
DROP POLICY IF EXISTS "sp_ledger_service_role_all" ON public.sp_ledger;
CREATE POLICY "sp_ledger_service_role_all" ON public.sp_ledger
  FOR ALL TO service_role
  USING (true);

/*
==================================================
VERIFICATION QUERIES
==================================================
*/

-- 1. Verify NO anon policies remain on sp_wallets
-- SELECT policyname, cmd, roles FROM pg_policies 
-- WHERE tablename = 'sp_wallets' AND roles::text LIKE '%anon%';
-- EXPECTED: 0 rows

-- 2. Verify NO anon policies remain on sp_ledger
-- SELECT policyname, cmd, roles FROM pg_policies 
-- WHERE tablename = 'sp_ledger' AND roles::text LIKE '%anon%';
-- EXPECTED: 0 rows

-- 3. List all current policies on sp_wallets
-- SELECT policyname, cmd, permissive, roles, qual, with_check 
-- FROM pg_policies WHERE tablename = 'sp_wallets';
-- EXPECTED: sp_wallets_select_own (authenticated) + sp_wallets_service_role_all (service_role)

-- 4. List all current policies on sp_ledger
-- SELECT policyname, cmd, permissive, roles, qual, with_check 
-- FROM pg_policies WHERE tablename = 'sp_ledger';
-- EXPECTED: sp_ledger_select_own (authenticated) + sp_ledger_service_role_all (service_role)

-- 5. RLS enabled check
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE tablename IN ('sp_wallets', 'sp_ledger');
-- EXPECTED: both TRUE

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ ZERO anon policies on sp_wallets
✓ ZERO anon policies on sp_ledger
✓ Authenticated users can SELECT only their own wallet
✓ Authenticated users can SELECT only their own ledger entries
✓ Direct INSERT/UPDATE by authenticated users is blocked (only via RPC/service_role)
✓ Service role has full access (admin operations still work)
✓ Existing SP flows still function (earning, spending, pending release)
✓ Admin portal SP wallet management still works (uses service role)
*/
```

---

### Output Files

1. **supabase/migrations/20260601000002_fix_sp_wallet_rls_security.sql** — RLS fix migration

---

### Testing Steps

1. **Run migration in Supabase SQL Editor**
2. **Verify anon access blocked:**
   - Use Supabase client with anon key
   - `supabase.from('sp_wallets').select('*')` → should return 0 rows
3. **Verify authenticated access works:**
   - Login as test user
   - `supabase.from('sp_wallets').select('*')` → should return ONLY own wallet
4. **Verify admin still works:**
   - Admin portal SP wallet page should still show all wallets (uses service role)

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Write migration | 30 min |
| Test on local Supabase | 30 min |
| Verify SP flows still work | 30 min |
| Verify admin portal still works | 30 min |
| **Total** | **~2 hours** |

---

## TASK PROD-002: Restrict admin_config RLS (Security Fix)

**Duration:** 1.5 hours  
**Priority:** High (P1 — Internal config publicly readable)  
**Dependencies:** None

### Description

The `admin_config` table has `USING (true)` RLS policies, making all configuration (fee rates, feature flags, trial settings) readable by anyone. While not a direct exploit, it leaks business-sensitive internal configuration.

Fix: Restrict read access to authenticated users only, and write access to admin/service_role only.

---

### AI Prompt for Cursor (Fix admin_config RLS)

```sql
/*
TASK: Restrict admin_config RLS policies

CONTEXT:
- admin_config stores fee rates, feature flags, trial settings, SP config
- Currently has USING (true) allowing public read access
- Mobile app reads some config values (e.g., trial_days for display) — needs authenticated SELECT
- Only admin/service_role should INSERT/UPDATE/DELETE

==================================================
Migration: Fix admin_config RLS
==================================================
*/

-- filepath: supabase/migrations/20260601000003_fix_admin_config_rls.sql
-- Mode: idempotent (safe to re-run)

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "admin_config_select_all" ON public.admin_config;
DROP POLICY IF EXISTS "admin_config_public_read" ON public.admin_config;
DROP POLICY IF EXISTS "Anyone can read admin_config" ON public.admin_config;
DROP POLICY IF EXISTS "admin_config_read" ON public.admin_config;

-- Ensure RLS is enabled
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read config (needed for mobile app to display trial info, fee info, etc.)
CREATE POLICY "admin_config_authenticated_read" ON public.admin_config
  FOR SELECT TO authenticated
  USING (true);

-- Service role can do everything (admin operations)
DROP POLICY IF EXISTS "admin_config_service_role_all" ON public.admin_config;
CREATE POLICY "admin_config_service_role_all" ON public.admin_config
  FOR ALL TO service_role
  USING (true);

/*
==================================================
VERIFICATION QUERIES
==================================================
*/

-- 1. No anon/public read policies
-- SELECT policyname, roles FROM pg_policies 
-- WHERE tablename = 'admin_config' AND roles::text LIKE '%anon%';
-- EXPECTED: 0 rows

-- 2. Authenticated read exists
-- SELECT policyname, roles FROM pg_policies 
-- WHERE tablename = 'admin_config' AND roles::text LIKE '%authenticated%';
-- EXPECTED: admin_config_authenticated_read

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Anonymous users cannot read admin_config
✓ Authenticated users can read admin_config
✓ Only service_role can write to admin_config
✓ Mobile app config fetches still work (authenticated)
✓ Admin portal config management still works (service_role)
*/
```

---

### Output Files

1. **supabase/migrations/20260601000003_fix_admin_config_rls.sql** — RLS fix migration

---

### Testing Steps

1. **Run migration**
2. **Test anon access blocked:** Use anon key → `supabase.from('admin_config').select('*')` → 0 rows
3. **Test authenticated access:** Login → same query → returns config rows
4. **Test admin write:** Admin portal → update config → succeeds

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Write migration | 20 min |
| Test anon blocked | 15 min |
| Test authenticated read | 15 min |
| Test admin write | 15 min |
| Verify mobile app still fetches config | 15 min |
| **Total** | **~1.5 hours** |

---

## TASK PROD-003: Edge Function Rate Limiting (Security Fix)

**Duration:** 4 hours  
**Priority:** High (P1 — DDoS/abuse vulnerability)  
**Dependencies:** None

### Description

None of the 52+ Edge Functions have rate limiting. An attacker can:
- Spam listing creation, trade initiation, or message sending
- Brute-force phone verification codes
- Overwhelm the database with queries

Implement a reusable rate limiting middleware for Supabase Edge Functions using an in-memory rate limiter with per-user and per-IP limits. For production scale, this can later be replaced with Redis-based limiting.

---

### AI Prompt for Cursor (Edge Function Rate Limiting)

```typescript
/*
TASK: Create reusable rate limiting middleware for Supabase Edge Functions

CONTEXT:
- Edge Functions are Deno/TypeScript at: supabase/functions/
- Shared code at: supabase/functions/_shared/
- Functions run on Deno Deploy — cannot use Node.js packages
- For MVP: use in-memory rate limiter (resets on function cold start)
- For production upgrade: TODO — move to Supabase table-based rate limiting or Upstash Redis

REQUIREMENTS:
1. Create a RateLimiter utility at _shared/rate-limiter.ts
2. Support per-user (by JWT user_id) and per-IP rate limits
3. Configurable: requests per window, window size in seconds
4. Return structured error when rate limit exceeded
5. Log rate limit violations
6. Provide helper to extract rate limit headers (X-RateLimit-Remaining, etc.)

DEFAULTS (per endpoint type):
- Auth endpoints (signup, login, verify): 5 requests per 60 seconds per IP
- Write endpoints (create listing, create trade): 10 requests per 60 seconds per user
- Read endpoints (fetch listings, search): 30 requests per 60 seconds per user
- Messaging: 20 messages per 60 seconds per user

==================================================
FILE 1: Rate Limiter Utility
==================================================
*/

// filepath: supabase/functions/_shared/rate-limiter.ts

interface RateLimitConfig {
  maxRequests: number;    // Max requests allowed
  windowSeconds: number;  // Time window in seconds
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;  // Unix timestamp when window resets
}

// In-memory store (resets on cold start — acceptable for MVP)
const store = new Map<string, { count: number; resetAt: number }>();

// Cleanup old entries every 5 minutes to prevent memory leak
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  
  lastCleanup = now;
  const nowSec = Math.floor(now / 1000);
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < nowSec) {
      store.delete(key);
    }
  }
}

/**
 * Check rate limit for a given key (user_id or IP).
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupExpired();

  const nowSec = Math.floor(Date.now() / 1000);
  const entry = store.get(key);

  // No entry or window expired — reset
  if (!entry || entry.resetAt < nowSec) {
    const resetAt = nowSec + config.windowSeconds;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  // Within window
  if (entry.count < config.maxRequests) {
    entry.count++;
    return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
  }

  // Rate limit exceeded
  return { allowed: false, remaining: 0, resetAt: entry.resetAt };
}

/**
 * Pre-configured rate limit profiles.
 */
export const RATE_LIMITS = {
  AUTH: { maxRequests: 5, windowSeconds: 60 },
  WRITE: { maxRequests: 10, windowSeconds: 60 },
  READ: { maxRequests: 30, windowSeconds: 60 },
  MESSAGING: { maxRequests: 20, windowSeconds: 60 },
  SENSITIVE: { maxRequests: 3, windowSeconds: 60 },  // Password reset, phone verify
} as const;

/**
 * Create a rate-limited response with proper headers.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        retryAfter: result.resetAt - Math.floor(Date.now() / 1000),
      },
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(result.resetAt),
        'Retry-After': String(result.resetAt - Math.floor(Date.now() / 1000)),
      },
    }
  );
}

/**
 * Add rate limit headers to a successful response.
 */
export function addRateLimitHeaders(headers: Headers, result: RateLimitResult): void {
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset', String(result.resetAt));
}

/*
==================================================
FILE 2: Example usage in an Edge Function
==================================================
*/

// filepath: supabase/functions/_shared/rate-limiter-example.ts
// (THIS IS DOCUMENTATION ONLY — shows how to use in any Edge Function)

/*
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from './_shared/rate-limiter.ts';

Deno.serve(async (req) => {
  // Extract user identifier for rate limiting
  const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
  const authHeader = req.headers.get('authorization');
  
  // For auth endpoints, rate limit by IP
  const rlKey = `auth:${clientIP}`;
  const rlResult = checkRateLimit(rlKey, RATE_LIMITS.AUTH);
  
  if (!rlResult.allowed) {
    console.warn('[rate-limit] Exceeded:', { key: rlKey, resetAt: rlResult.resetAt });
    return rateLimitResponse(rlResult);
  }

  // ... rest of the function
});
*/

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ _shared/rate-limiter.ts exports checkRateLimit, RATE_LIMITS, rateLimitResponse, addRateLimitHeaders
✓ In-memory store with automatic cleanup (no memory leak)
✓ Returns 429 with structured error when limit exceeded
✓ Includes standard rate limit headers (X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After)
✓ Pre-configured profiles: AUTH (5/60s), WRITE (10/60s), READ (30/60s), MESSAGING (20/60s), SENSITIVE (3/60s)
✓ Works in Deno environment (no Node.js dependencies)
✓ Passes Deno lint: cd supabase && deno lint functions/_shared/rate-limiter.ts

==================================================
NEXT TASK
==================================================

PROD-004: Node Isolation at RLS Level
*/
```

---

### Output Files

1. **supabase/functions/_shared/rate-limiter.ts** — Reusable rate limiting utility

---

### Testing Steps

1. **Deno lint:**
   - `cd supabase && deno lint functions/_shared/rate-limiter.ts`

2. **Unit test:**
   ```typescript
   // Test: 5 requests allowed, 6th blocked
   // Test: Window expiry resets counter
   // Test: Different keys have independent limits
   ```

3. **Integration test:**
   - Apply to one Edge Function (e.g., signup)
   - Send 6 rapid requests → 6th should return 429
   - Wait 60 seconds → should work again

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Create rate-limiter.ts utility | 60 min |
| Write Deno unit tests | 45 min |
| Apply to 3 critical Edge Functions (auth, listings, trades) | 60 min |
| Integration testing | 30 min |
| Documentation | 15 min |
| **Total** | **~4 hours** |

---

## TASK PROD-004: Node Isolation at RLS Level (Security Fix)

**Duration:** 3 hours  
**Priority:** High (P1 — Cross-node data leakage)  
**Dependencies:** PROD-001 (SP wallet RLS must be fixed first)

### Description

Currently, RLS policies on `items`, `trades`, and `messages` tables only check `user_id = auth.uid()` for ownership — they do **not** enforce that users can only see data within their assigned node. A user in Node A can query and see listings from Node B by crafting direct Supabase queries.

Fix: Add node_id-based RLS policies so users can only access data in their assigned node(s).

---

### AI Prompt for Cursor (Node Isolation RLS)

```sql
/*
TASK: Add node isolation to RLS policies on items, trades, and messages

CONTEXT:
- profiles table has: node_id (UUID) — the user's assigned node
- items table has: node_id (UUID) — the node where the item is listed
- trades table has: node_id (UUID) — inherited from the item's node
- messages table: linked via trade_id → trades.node_id
- Current RLS only checks user_id, not node_id
- Users should only see items/trades in their own node
- Admin/service_role should see everything

REQUIREMENTS:
1. Update items SELECT policy to include node_id check
2. Update trades SELECT policy to include node_id check  
3. Add helper function get_user_node_id(p_user_id UUID) for reuse
4. Preserve existing user_id checks (don't break ownership rules)
5. Preserve service_role full access

==================================================
Migration: Node isolation RLS
==================================================
*/

-- filepath: supabase/migrations/20260601000004_node_isolation_rls.sql
-- Mode: idempotent (safe to re-run)

-- Helper function: get user's node_id
CREATE OR REPLACE FUNCTION public.get_user_node_id(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_node_id UUID;
BEGIN
  SELECT p.node_id INTO v_node_id
  FROM public.profiles p
  WHERE p.user_id = p_user_id;
  RETURN v_node_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================
-- Items: Users can only see items in their node
-- ============================================

-- Drop existing select policy
DROP POLICY IF EXISTS "items_select_all_active" ON public.items;
DROP POLICY IF EXISTS "items_select_own_node" ON public.items;
DROP POLICY IF EXISTS "Anyone can view active items" ON public.items;

-- Users can view items in their assigned node
CREATE POLICY "items_select_own_node" ON public.items
  FOR SELECT TO authenticated
  USING (
    items.node_id = public.get_user_node_id(auth.uid())
    OR items.seller_id = auth.uid()  -- Sellers can always see their own items
  );

-- Service role: full access
DROP POLICY IF EXISTS "items_service_role_all" ON public.items;
CREATE POLICY "items_service_role_all" ON public.items
  FOR ALL TO service_role
  USING (true);

-- ============================================
-- Trades: Users can only see trades in their node
-- ============================================

DROP POLICY IF EXISTS "trades_select_participants" ON public.trades;
DROP POLICY IF EXISTS "trades_select_own_node" ON public.trades;

-- Users can see trades where they are buyer/seller AND in their node
CREATE POLICY "trades_select_own_node" ON public.trades
  FOR SELECT TO authenticated
  USING (
    (trades.buyer_id = auth.uid() OR trades.seller_id = auth.uid())
    AND trades.node_id = public.get_user_node_id(auth.uid())
  );

-- Service role: full access
DROP POLICY IF EXISTS "trades_service_role_all" ON public.trades;
CREATE POLICY "trades_service_role_all" ON public.trades
  FOR ALL TO service_role
  USING (true);

/*
==================================================
VERIFICATION QUERIES
==================================================
*/

-- 1. Verify items policies include node check
-- SELECT policyname, qual FROM pg_policies WHERE tablename = 'items' AND roles::text LIKE '%authenticated%';

-- 2. Verify trades policies include node check
-- SELECT policyname, qual FROM pg_policies WHERE tablename = 'trades' AND roles::text LIKE '%authenticated%';

-- 3. Test cross-node visibility (should return 0 for items from other node)
-- SELECT count(*) FROM items WHERE items.node_id != '<user_node_id>';

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Users can only see items in their assigned node
✓ Users can always see their own listed items (even if node changes)
✓ Users can only see trades they are party to AND in their node
✓ Service role sees everything (admin portal works)
✓ get_user_node_id helper function exists and is reusable
✓ Discovery feed only shows same-node items
*/
```

---

### Output Files

1. **supabase/migrations/20260601000004_node_isolation_rls.sql** — Node isolation migration

---

### Testing Steps

1. **Run migration**
2. **Test as User A (Node 1):**
   - Query items → should only see Node 1 items
   - Query trades → should only see own trades in Node 1
3. **Test as User B (Node 2):**
   - Should NOT see User A's items from Node 1
4. **Test admin:**
   - Admin portal should still show ALL items/trades (service_role)

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Write helper function + migration | 45 min |
| Test node isolation with sample data | 45 min |
| Verify admin still works | 30 min |
| Verify mobile app discovery feed | 30 min |
| **Total** | **~3 hours** |

---

## TASK PROD-005: Edge Function Stripe Connect Ownership Verification

**Duration:** 2 hours  
**Priority:** High (P1 — Payout method hijacking)  
**Dependencies:** None

### Description

The `create-stripe-account-link` and `sync-stripe-connect-status` Edge Functions accept a Stripe account ID but do not verify that the authenticated user owns that Stripe Connect account. An attacker could call these functions with someone else's Stripe account ID.

Add ownership verification: check that the Stripe Connect account is linked to the authenticated user's profile before proceeding.

---

### AI Prompt for Cursor (Stripe Connect Ownership Check)

```typescript
/*
TASK: Add ownership verification to Stripe Connect Edge Functions

CONTEXT:
- Edge Functions at: supabase/functions/create-stripe-account-link/index.ts
  and supabase/functions/sync-stripe-connect-status/index.ts
- profiles table has: stripe_connect_account_id (or payout_methods table has it)
- User's JWT provides user_id via auth
- Must verify: the stripe_account_id in the request matches what's stored for auth.uid()

REQUIREMENTS:
1. Before creating account link, verify stripe_connect_account_id belongs to the user
2. Before syncing status, verify the account belongs to the user
3. Return 403 Forbidden if ownership check fails
4. Log ownership check failures for security audit

==================================================
SHARED HELPER
==================================================
*/

// filepath: supabase/functions/_shared/verify-stripe-ownership.ts

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Verify that a Stripe Connect account belongs to the authenticated user.
 * Returns true if the user owns the account, false otherwise.
 */
export async function verifyStripeAccountOwnership(
  supabase: SupabaseClient,
  userId: string,
  stripeAccountId: string
): Promise<{ owned: boolean; error?: string }> {
  // Check profiles table for matching stripe_connect_account_id
  const { data, error } = await supabase
    .from('profiles')
    .select('stripe_connect_account_id')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.error('[verify-stripe-ownership] Profile lookup failed:', { userId, error: error?.message });
    return { owned: false, error: 'Profile not found' };
  }

  if (data.stripe_connect_account_id !== stripeAccountId) {
    console.warn('[verify-stripe-ownership] OWNERSHIP MISMATCH:', {
      userId,
      requestedAccount: stripeAccountId,
      actualAccount: data.stripe_connect_account_id,
    });
    return { owned: false, error: 'Stripe account does not belong to this user' };
  }

  return { owned: true };
}

/**
 * Return a 403 response for ownership verification failure.
 */
export function ownershipDeniedResponse(detail: string): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'STRIPE_ACCOUNT_OWNERSHIP_DENIED',
        message: 'You do not have permission to access this Stripe account.',
        details: detail,
      },
    }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/*
==================================================
USAGE: In create-stripe-account-link/index.ts, ADD after JWT validation:
==================================================
*/

// import { verifyStripeAccountOwnership, ownershipDeniedResponse } from '../_shared/verify-stripe-ownership.ts';
//
// const ownership = await verifyStripeAccountOwnership(supabase, user.id, stripeAccountId);
// if (!ownership.owned) {
//   return ownershipDeniedResponse(ownership.error || 'Not your account');
// }

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ create-stripe-account-link verifies ownership before creating link
✓ sync-stripe-connect-status verifies ownership before syncing
✓ 403 returned with STRIPE_ACCOUNT_OWNERSHIP_DENIED code on mismatch
✓ Ownership check failures logged with user_id + requested account
✓ Legitimate users unaffected
*/
```

---

### Output Files

1. **supabase/functions/_shared/verify-stripe-ownership.ts** — Ownership verification helper
2. **supabase/functions/create-stripe-account-link/index.ts** — Updated with ownership check
3. **supabase/functions/sync-stripe-connect-status/index.ts** — Updated with ownership check

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Create verify-stripe-ownership.ts | 30 min |
| Update create-stripe-account-link | 20 min |
| Update sync-stripe-connect-status | 20 min |
| Test with correct ownership | 15 min |
| Test with wrong ownership (403) | 15 min |
| Verify Deno lint passes | 10 min |
| **Total** | **~2 hours** |

---

## TASK PROD-006: TypeScript Strictness — Enable noImplicitAny

**Duration:** 6 hours  
**Priority:** Medium (P2 — Type safety holes cause subtle bugs)  
**Dependencies:** None (can be done in parallel with other tasks)

### Description

`tsconfig.json` has `noImplicitAny: false`, meaning TypeScript silently allows untyped variables throughout the codebase. This hides bugs where parameters or return types are accidentally `any`, bypassing all type checking.

Fix:
1. Enable `noImplicitAny: true` in tsconfig.json
2. Fix all resulting type errors across the codebase
3. This is a large task — expect 50-200+ type errors to fix

---

### AI Prompt for Cursor (Enable noImplicitAny)

```typescript
/*
TASK: Enable noImplicitAny: true and fix all type errors

CONTEXT:
- tsconfig.json at: p2p-kids-marketplace/tsconfig.json
- Currently: "noImplicitAny": false
- strict: true is already enabled, but noImplicitAny overrides it to false
- Expect many type errors across services, screens, and utility files

APPROACH:
1. Change noImplicitAny to true
2. Run: npx tsc --noEmit 2>&1 | head -100
3. Fix errors in batches:
   a. Service files (most critical — API contract types)
   b. Screen components (event handlers, navigation params)
   c. Utility functions (pure logic)
   d. Test files (mock types)

COMMON FIXES:
- Event handlers: (e) => ... → (e: any) is WRONG; use specific types like (e: NativeSyntheticEvent<...>)
- Supabase responses: .data → type the generic: supabase.from('table').select<Table>()
- Catch blocks: catch (e) → catch (e: unknown) { if (e instanceof Error) ... }
- Function params: function fn(data) → function fn(data: SpecificType)
- Callback params: .map((item) => → .map((item: ItemType) =>

==================================================
Step 1: Update tsconfig.json
==================================================
*/

// filepath: p2p-kids-marketplace/tsconfig.json (UPDATE)
// CHANGE: "noImplicitAny": false → "noImplicitAny": true

/*
==================================================
Step 2: Run type check and fix errors
==================================================
*/

// Run: cd p2p-kids-marketplace && npx tsc --noEmit 2>&1 | wc -l
// This tells you how many errors exist.

// Then fix file by file, prioritizing:
// 1. src/services/* (API contracts)
// 2. src/contexts/* (state management)
// 3. src/screens/* (UI components)
// 4. src/utils/* (helpers)

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ tsconfig.json has "noImplicitAny": true
✓ npx tsc --noEmit exits with code 0
✓ No type assertions to `any` as workarounds (use `unknown` + type guards instead)
✓ All event handlers properly typed
✓ All Supabase query results properly typed
✓ All catch blocks use `unknown` with instanceof checks
*/
```

---

### Output Files

1. **p2p-kids-marketplace/tsconfig.json** — Updated
2. **Various src/ files** — Type annotations added

---

### Testing Steps

1. **Enable and measure:**
   - `cd p2p-kids-marketplace && npx tsc --noEmit 2>&1 | wc -l`
   - Note initial error count

2. **Fix errors in batches, re-check after each batch**

3. **Final verification:**
   - `cd p2p-kids-marketplace && npx tsc --noEmit` → exit code 0
   - `cd p2p-kids-marketplace && npx eslint src/` → exit code 0

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Enable flag + measure initial errors | 15 min |
| Fix service files (~30% of errors) | 90 min |
| Fix context files | 30 min |
| Fix screen files (~40% of errors) | 90 min |
| Fix utility + test files | 45 min |
| Final verification | 15 min |
| **Total** | **~6 hours** |

---

## TASK PROD-007: Fix ESLint Failures

**Duration:** 3 hours  
**Priority:** Medium (P2 — Code quality gate)  
**Dependencies:** PROD-006 (do TypeScript strictness first — some lint errors overlap)

### Description

`yarn lint` (ESLint) currently exits with code 1. All lint errors must be resolved before store submission to ensure code quality.

---

### AI Prompt for Cursor (Fix Lint Errors)

```typescript
/*
TASK: Fix all ESLint errors in the mobile app

CONTEXT:
- Config: p2p-kids-marketplace/.eslintrc.js
- Run: cd p2p-kids-marketplace && npx eslint src/ --format compact 2>&1 | tail -20
- Common error categories:
  a. Unused variables/imports
  b. React hooks dependency arrays
  c. Missing return types
  d. Duplicate exports (if any remain)

APPROACH:
1. Run eslint with --format compact to see error summary
2. Fix auto-fixable errors: npx eslint src/ --fix
3. Manually fix remaining errors
4. Do NOT suppress errors with // eslint-disable unless truly necessary
5. If a rule is consistently wrong for the project, disable it in .eslintrc.js with a comment explaining why

==================================================
Step 1: Measure
==================================================
*/

// cd p2p-kids-marketplace && npx eslint src/ 2>&1 | grep -c "error"
// cd p2p-kids-marketplace && npx eslint src/ --fix

/*
==================================================
Step 2: Fix remaining errors manually
==================================================
*/

// Priority fix order:
// 1. Unused imports (delete them)
// 2. Missing React hook dependencies (add to dep array or use useCallback)
// 3. Any duplicate identifiers
// 4. Type-related lint errors

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ npx eslint src/ exits with code 0
✓ No // eslint-disable-next-line without explanation comment
✓ No unused imports remaining
✓ React hooks rules satisfied (deps arrays correct)
*/
```

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Run initial lint + measure | 10 min |
| Auto-fix | 10 min |
| Fix unused imports/variables | 30 min |
| Fix hooks dependency arrays | 45 min |
| Fix remaining errors | 60 min |
| Final verification | 15 min |
| **Total** | **~3 hours** |

---

## TASK PROD-008: Fix Test Failures

**Duration:** 4 hours  
**Priority:** Medium (P2 — Test suite must pass for CI/CD)  
**Dependencies:** PROD-006, PROD-007 (fix types and lint first)

### Description

`npm run test:all` exits with code 1. All tests must pass for production CI/CD gate.

---

### AI Prompt for Cursor (Fix Test Failures)

```typescript
/*
TASK: Fix all failing tests

APPROACH:
1. Run full test suite with verbose output:
   cd p2p-kids-marketplace && npx jest --verbose 2>&1 | tail -50
2. Categorize failures:
   a. Type errors (fixed by PROD-006)
   b. Mock setup issues
   c. Stale snapshots  
   d. Async timeout issues
   e. Missing test data
3. Fix in order of severity
4. For tests that test external services (Stripe, Twilio), ensure mocks are in place
5. Skip E2E tests that require live infrastructure (mark with .skip + TODO comment)

RULES:
- Do NOT delete failing tests to make the suite pass
- Do NOT change test assertions to match broken behavior
- Fix the actual issue or mark with .skip + detailed TODO explaining what needs to change

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ npx jest exits with code 0
✓ All unit tests pass
✓ Skipped tests have TODO comments explaining why
✓ No test files deleted
✓ Test coverage does not decrease
*/
```

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Run test suite + categorize failures | 30 min |
| Fix type-related test failures | 45 min |
| Fix mock setup issues | 60 min |
| Fix async/timeout issues | 45 min |
| Mark E2E tests that need infra | 20 min |
| Final verification | 20 min |
| **Total** | **~4 hours** |

---

## TASK PROD-009: App Store Metadata & Privacy Policy

**Duration:** 3 hours  
**Priority:** High (P1 — Required for store submission)  
**Dependencies:** PROD-P001 (iOS privacy descriptions)

### Description

For Apple App Store and Google Play submission, the app needs:
1. **Privacy Policy URL** — hosted page describing data collection/usage (REQUIRED by both stores)
2. **Terms of Service URL** — hosted page with user agreement
3. **Age Rating Declaration** — must declare this is a kids app with proper age gating
4. **App Description, Screenshots** — marketing assets (store listing)
5. **Data Safety Section** (Google Play) — matching the PrivacyInfo.xcprivacy declarations
6. **COPPA Compliance Declaration** — both stores ask if the app is directed at children

This task creates the privacy policy and terms of service as hosted pages, and documents the store submission checklist.

---

### AI Prompt for Cursor (Store Submission Preparation)

```typescript
/*
TASK: Create privacy policy, terms of service, and store submission checklist

CONTEXT:
- This is a KIDS peer-to-peer marketplace app
- Collects: email, phone (optional), coarse location, photos, purchase history
- Uses: Supabase Auth, Firebase Analytics, Stripe payments
- Age range: kids under 18 with parental consent for under 13
- Must comply with COPPA (US), GDPR-K (EU if applicable)

REQUIREMENTS:
1. Create a privacy policy page (can be React Native WebView or hosted HTML)
2. Create a terms of service page
3. Create a store submission checklist document
4. Add privacy policy URL to app.json (for both iOS and Android store listings)

NOTE: The privacy policy text should be reviewed by legal counsel before publishing.
Mark it as DRAFT with TODO for legal review.

==================================================
FILE 1: Store Submission Checklist
==================================================
*/

// filepath: docs/STORE-SUBMISSION-CHECKLIST.md

/*
# App Store Submission Checklist

## Apple App Store (iOS)

### Required Before Submission
- [ ] App builds with `eas build --platform ios --profile production`
- [ ] Privacy Policy URL hosted and accessible
- [ ] Terms of Service URL hosted and accessible
- [ ] NSUsageDescription strings in Info.plist (PROD-P001)
- [ ] PrivacyInfo.xcprivacy privacy manifest (PROD-P001)
- [ ] Age Rating: set to "Made for Kids" or "4+" with parental gate
- [ ] COPPA compliance declaration: "Yes, this app is directed at children under 13"
- [ ] App Category: "Shopping" or "Lifestyle"
- [ ] Screenshots: 6.7" (iPhone 15 Pro Max) and 6.5" (iPhone 14 Plus)
- [ ] App Icon: 1024x1024 without alpha channel
- [ ] No test/debug code in production build
- [ ] No placeholder content
- [ ] Error Boundary prevents blank screens (PROD-P003)
- [ ] Crash reporting active (PROD-P004)

### Apple-Specific Requirements for Kids Apps
- [ ] No third-party analytics that tracks children (Firebase Analytics must be configured for COPPA)
- [ ] No advertising SDKs
- [ ] No social media login (only email/password)
- [ ] Parental consent gate for under-13 users
- [ ] No external links that leave the app without parental gate
- [ ] Privacy policy must be accessible from within the app

## Google Play Store (Android)

### Required Before Submission
- [ ] AAB builds with `eas build --platform android --profile production`
- [ ] Privacy Policy URL set in Play Console
- [ ] Data Safety section completed (matches PrivacyInfo.xcprivacy)
- [ ] Target audience: declare as "Mixed audience" (kids + parents)
- [ ] Families Policy compliance (if targeting under 13)
- [ ] Content Rating: complete IARC questionnaire
- [ ] App Category: "Shopping"
- [ ] Feature graphic: 1024x500
- [ ] Screenshots: phone + tablet
- [ ] COPPA compliance: declare in Play Console

### Data Safety Declaration (Google Play)
- Data collected:
  - [x] Email address (Account management)
  - [x] Phone number (Account management, optional)
  - [x] Approximate location (App functionality)
  - [x] Photos (App functionality — listing images)
  - [x] Purchase history (App functionality)
  - [x] App interactions (Analytics)
- Data shared with third parties:
  - [x] Stripe (payment processing)
  - [x] Firebase (analytics — COPPA-compliant configuration)
- Data NOT collected:
  - [x] Precise location (only coarse/ZIP-based)
  - [x] Contacts
  - [x] Messages outside the app
  - [x] Health/fitness data

*/

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ docs/STORE-SUBMISSION-CHECKLIST.md created with full checklist
✓ Privacy policy draft created (marked DRAFT — needs legal review)
✓ Terms of service draft created (marked DRAFT — needs legal review)
✓ URLs configured in app for in-app access
✓ All items in checklist mapped to specific tasks in this module
*/
```

---

### Output Files

1. **docs/STORE-SUBMISSION-CHECKLIST.md** — Complete submission checklist
2. **docs/PRIVACY-POLICY-DRAFT.md** — Draft privacy policy (requires legal review)
3. **docs/TERMS-OF-SERVICE-DRAFT.md** — Draft terms of service (requires legal review)

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Research current Apple/Google requirements for kids apps | 30 min |
| Create store submission checklist | 30 min |
| Draft privacy policy | 45 min |
| Draft terms of service | 30 min |
| Add URL references to app | 15 min |
| Review against COPPA/GDPR-K requirements | 30 min |
| **Total** | **~3 hours** |

---

## TASK PROD-010: Consolidate Admin Authentication

**Duration:** 3 hours  
**Priority:** Medium (P2 — Inconsistent auth = security holes)  
**Dependencies:** PROD-P002 (service role key fix)

### Description

The admin portal uses **multiple inconsistent authentication methods** across different files:
- Some files check `NEXT_PUBLIC_ADMIN_UI_SECRET` header
- Some use Supabase Auth session
- Some use service role key directly
- `admin-trade-action` Edge Function has 4 different auth fallbacks

Consolidate to a single pattern:
1. All admin API routes use a shared `verifyAdminAuth()` middleware
2. Single source of truth for admin verification
3. No fallback chains — one clear auth path

---

### AI Prompt for Cursor (Consolidate Admin Auth)

```typescript
/*
TASK: Create a single admin authentication middleware for the admin portal

CONTEXT:
- Admin portal: p2p-kids-admin/ (Next.js 14)
- API routes at: src/app/api/admin/*
- Current inconsistency: some check ADMIN_UI_SECRET, some check Supabase auth, some fallback chain
- Database has: role_based_access_control table, is_admin() function

REQUIREMENTS:
1. Create a shared admin auth middleware at: p2p-kids-admin/src/lib/adminAuth.ts
2. Single verifyAdminAuth(req: NextRequest) function that:
   a. Checks ADMIN_UI_SECRET header match (for server-to-server calls)
   b. OR checks Supabase session JWT + is_admin() for user-initiated calls
   c. Returns { authorized: true, adminId: string } or { authorized: false, error: string }
3. Update ALL admin API routes to use this middleware
4. Remove all inline auth checking from individual routes

==================================================
FILE 1: Admin Auth Middleware
==================================================
*/

// filepath: p2p-kids-admin/src/lib/adminAuth.ts

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface AdminAuthResult {
  authorized: boolean;
  adminId?: string;
  error?: string;
}

const ADMIN_UI_SECRET = process.env.ADMIN_UI_SECRET || process.env.NEXT_PUBLIC_ADMIN_UI_SECRET;

/**
 * Verify that the request comes from an authorized admin.
 * 
 * Auth methods (checked in order):
 * 1. x-admin-secret header matches ADMIN_UI_SECRET
 * 2. Supabase JWT in Authorization header with is_admin() = true
 * 
 * Use this at the top of every admin API route:
 * ```ts
 * const auth = await verifyAdminAuth(req);
 * if (!auth.authorized) {
 *   return NextResponse.json({ error: auth.error }, { status: 401 });
 * }
 * ```
 */
export async function verifyAdminAuth(req: NextRequest): Promise<AdminAuthResult> {
  // Method 1: Admin UI secret (for internal/server calls)
  const adminSecret = req.headers.get('x-admin-secret');
  if (adminSecret && ADMIN_UI_SECRET && adminSecret === ADMIN_UI_SECRET) {
    return { authorized: true, adminId: 'admin-secret' };
  }

  // Method 2: Supabase JWT + is_admin check
  const authorization = req.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.substring(7);
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return { authorized: false, error: 'Server configuration error' };
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { authorized: false, error: 'Invalid or expired session' };
    }

    // Check admin role
    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (!isAdmin) {
      return { authorized: false, error: 'User is not an admin' };
    }

    return { authorized: true, adminId: user.id };
  }

  return { authorized: false, error: 'No valid authentication provided' };
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Single verifyAdminAuth function in src/lib/adminAuth.ts
✓ All admin API routes use verifyAdminAuth (no inline auth checks)
✓ Two auth methods: admin-secret header OR Supabase JWT + is_admin()
✓ No fallback to NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY anywhere
✓ Unauthorized requests get 401 with clear error message
✓ Admin portal still functions after migration
*/
```

---

### Output Files

1. **p2p-kids-admin/src/lib/adminAuth.ts** — Centralized admin auth middleware
2. **All API routes under src/app/api/admin/** — Updated to use verifyAdminAuth

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Create adminAuth.ts | 30 min |
| Audit all admin API routes | 30 min |
| Update routes to use middleware | 60 min |
| Test admin authentication flow | 30 min |
| Build verification | 15 min |
| **Total** | **~3 hours** |

---

## TASK PROD-011: Android Data Safety & Google Play Families Policy

**Duration:** 2 hours  
**Priority:** High (P1 — Required for Google Play)  
**Dependencies:** PROD-P001 (Android permissions), PROD-009 (Privacy policy)

### Description

Google Play requires:
1. **Data Safety form** in Play Console — must match what the app actually collects
2. **Families Policy compliance** if targeting children under 13
3. **Proper target API level** (currently must target API 34+)
4. Firebase Analytics configured for **COPPA compliance** (disable advertising ID collection)

---

### AI Prompt for Cursor (Google Play Compliance)

```typescript
/*
TASK: Configure Android app for Google Play Families Policy compliance

CONTEXT:
- app.json at: p2p-kids-marketplace/app.json
- Firebase Analytics is used
- App targets kids → must comply with Google Play Families Policy
- Must disable AAID (Android Advertising ID) collection for COPPA

REQUIREMENTS:
1. Configure Firebase Analytics for COPPA mode
2. Set proper targetSdkVersion in app.json
3. Disable ad ID collection
4. Document Data Safety form responses

==================================================
FILE 1: Firebase Analytics COPPA Configuration
==================================================
*/

// filepath: p2p-kids-marketplace/src/services/analytics.ts (UPDATE)

// ADD at initialization:
// import analytics from '@react-native-firebase/analytics';
//
// At app startup (before any analytics calls):
// await analytics().setAnalyticsCollectionEnabled(true);
// // COPPA compliance: disable advertising ID and personalization
// await analytics().setUserProperty('allow_personalized_ads', 'false');
// // Note: For full COPPA compliance, also configure in Firebase Console:
// // Project Settings → Integrations → Disable Google Ads linking

/*
==================================================
FILE 2: Update app.json for Android target SDK
==================================================
*/

// filepath: p2p-kids-marketplace/app.json (UPDATE android section)

// ADD to android section:
// "compileSdkVersion": 35,
// "targetSdkVersion": 35,
// "minSdkVersion": 24

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Firebase Analytics configured for COPPA (no ad ID collection)
✓ Android targetSdkVersion >= 34
✓ Data Safety form responses documented
✓ Families Policy compliance documented
✓ No advertising SDKs included
*/
```

---

### Output Files

1. **p2p-kids-marketplace/src/services/analytics.ts** — Updated with COPPA config
2. **p2p-kids-marketplace/app.json** — Updated Android SDK versions
3. **docs/GOOGLE-PLAY-DATA-SAFETY.md** — Data Safety form answers

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Configure Firebase COPPA mode | 30 min |
| Update Android SDK version | 15 min |
| Document Data Safety responses | 45 min |
| Test Android build | 30 min |
| **Total** | **~2 hours** |

---

## TASK PROD-012: Production Environment Configuration & Secret Audit

**Duration:** 2 hours  
**Priority:** High (P1 — Secrets management)  
**Dependencies:** PROD-P002 (service role key fix)

### Description

Audit and secure all environment variables and secrets across both apps. Ensure:
1. No secrets in source code or client bundles
2. Proper .env.example files for all apps
3. All secrets documented with descriptions
4. Production-specific env vars identified and documented

---

### AI Prompt for Cursor (Secret Audit)

```typescript
/*
TASK: Audit and secure all environment variables

CONTEXT:
- Mobile app env: p2p-kids-marketplace/.env.local
- Admin app env: p2p-kids-admin/.env.local  
- Both have .env.example files (may be out of date)
- NEXT_PUBLIC_ prefixed vars are exposed to browser (admin app)
- EXPO_PUBLIC_ prefixed vars are exposed to app bundle (mobile app)

REQUIREMENTS:
1. Grep for ALL env var references across both apps
2. Classify each as: public (safe for client) vs secret (server-only)
3. Verify no secrets have NEXT_PUBLIC_ or EXPO_PUBLIC_ prefix
4. Update .env.example files with complete list + descriptions
5. Create docs/ENVIRONMENT-VARIABLES.md documenting all vars

CLASSIFICATION RULES:
- SAFE for client (NEXT_PUBLIC_ / EXPO_PUBLIC_): Supabase URL, Supabase anon key, Sentry DSN, Stripe publishable key, app URLs
- SERVER-ONLY (no prefix): Supabase service role key, Stripe secret key, Twilio auth token, SendGrid API key, admin secrets

==================================================
OUTPUT: docs/ENVIRONMENT-VARIABLES.md
==================================================
*/

// filepath: docs/ENVIRONMENT-VARIABLES.md

/*
# Environment Variables Reference

## Mobile App (p2p-kids-marketplace)

### Public (bundled into app — safe for client)
| Variable | Description | Required |
|----------|-------------|----------|
| EXPO_PUBLIC_SUPABASE_URL | Supabase project URL | Yes |
| EXPO_PUBLIC_SUPABASE_ANON_KEY | Supabase anonymous key | Yes |
| EXPO_PUBLIC_SENTRY_DSN | Sentry error reporting DSN | Prod only |
| EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY | Stripe publishable key | Yes |

### Secret (server-side only — NEVER bundle)
These should be in Supabase Edge Function secrets, NOT in the mobile app:
| Variable | Where Used | Description |
|----------|-----------|-------------|
| SUPABASE_SERVICE_ROLE_KEY | Edge Functions | Full DB access |
| STRIPE_SECRET_KEY | Edge Functions | Stripe API |
| TWILIO_AUTH_TOKEN | Edge Functions | SMS sending |
| SENDGRID_API_KEY | Edge Functions | Email sending |

## Admin Portal (p2p-kids-admin)

### Public (bundled into browser JS)
| Variable | Description |
|----------|-------------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anonymous key |
| NEXT_PUBLIC_ADMIN_UI_SECRET | Admin UI auth token |

### Server-Only (API routes only)
| Variable | Description |
|----------|-------------|
| SUPABASE_SERVICE_ROLE_KEY | Admin DB operations |
| STRIPE_SECRET_KEY | Stripe admin operations |
*/

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ ZERO secrets with NEXT_PUBLIC_ prefix (except ADMIN_UI_SECRET which is an auth token)
✓ ZERO secrets with EXPO_PUBLIC_ prefix
✓ .env.example files updated for both apps
✓ docs/ENVIRONMENT-VARIABLES.md documents all vars
✓ grep confirmation: no service_role key in client code
*/
```

---

### Output Files

1. **docs/ENVIRONMENT-VARIABLES.md** — Complete env var reference
2. **p2p-kids-marketplace/.env.local.example** — Updated
3. **p2p-kids-admin/.env.example** — Updated

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Grep for all env var references | 20 min |
| Classify public vs secret | 20 min |
| Update .env.example files | 20 min |
| Create documentation | 30 min |
| Verify no secret leaks | 30 min |
| **Total** | **~2 hours** |

---

## TASK PROD-013: Full-Stack Production Readiness & Security Scan (Client + Admin)

**Duration:** 5 hours  
**Priority:** Critical (P0 — Must run BEFORE any store submission or production deployment)  
**Dependencies:** None (should run FIRST as the very first task, OR as a final gate after all other PROD tasks)

### Description

Run a comprehensive, automated code-only scan of the **entire codebase** — both the mobile client (`p2p-kids-marketplace/`) and the admin portal (`p2p-kids-admin/`) — covering every app layer: source code, configuration, environment variables, database migrations, Edge Functions, RLS policies, dependencies, and build artifacts. Produce a single, structured findings report in `docs/PROD-SCAN-FINDINGS.md`.

This is NOT a manual review — the AI agent must **systematically grep, read, and analyze** every category below, reporting concrete file paths, line numbers, and code snippets for each finding. No finding should be vague or generic.

**Why this task exists:**  
Previous audits found issues piecemeal. This task ensures nothing is missed by running a single holistic sweep before store submission. The output document becomes the definitive punch list for the team.

---

### AI Prompt for Cursor (Full-Stack Production & Security Scan)

```text
@agent: claude-sonnet-4.5
@mode: extended-reasoning
@autonomy: high

AGENT INSTRUCTIONS:
You are performing a DEEP, EXHAUSTIVE, CODE-ONLY audit of two applications in
this monorepo. You must scan every file, not just "likely" files. You must
produce a structured Markdown report with EXACT file paths, line numbers, and
code snippets for every finding.

DO NOT:
- Guess or assume anything — verify by reading files.
- Skip any directory. Scan src/, lib/, app/, services/, contexts/, hooks/, utils/, navigation/, screens/, components/, supabase/, infra/, scripts/, e2e/, __tests__/.
- Omit low-severity findings — report everything and let humans prioritize.
- Produce generic advice without evidence ("you should add rate limiting" is NOT acceptable unless you show which endpoints lack it).

DO:
- For every finding, include: file path, line number(s), code snippet, severity (P0/P1/P2/P3), category, and recommended fix.
- Group findings by category.
- Provide summary counts at the top.
- Flag any finding that is an App Store / Play Store REJECTION risk.

==========================================================
SCAN SCOPE
==========================================================

App 1 — Mobile Client: p2p-kids-marketplace/
App 2 — Admin Portal:  p2p-kids-admin/
Shared — Supabase:     supabase/ (migrations, functions, seeds)
Shared — Infra:        infra/ (lambdas, cloudflare workers)
Shared — Scripts:      scripts/

==========================================================
CATEGORY 1: SECRETS & ENVIRONMENT VARIABLE LEAKS
==========================================================

SCAN FOR:
1. Hardcoded secrets, API keys, tokens, passwords anywhere in source code
   - grep: /api[_-]?key|secret[_-]?key|password|token|auth[_-]?token|private[_-]?key|service[_-]?role/i
   - Exclude: .env files, .env.example, node_modules, lock files
   - Flag: any match inside .ts, .tsx, .js, .jsx, .sql, .json (non-env) files

2. NEXT_PUBLIC_ prefixed secrets in admin portal
   - grep: /NEXT_PUBLIC_.*(?:SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|TOKEN(?!.*ANON))/i
   - Any match = P0

3. EXPO_PUBLIC_ prefixed secrets in mobile app
   - grep: /EXPO_PUBLIC_.*(?:SECRET|SERVICE_ROLE|PRIVATE|PASSWORD)/i
   - Any match = P0

4. .env files committed to git (check .gitignore covers all .env variants)
   - Verify: .env, .env.local, .env.staging, .env.production all in .gitignore
   - Check if any .env file is tracked: git ls-files '*.env*'

5. Secrets in console.log / console.error statements
   - grep for console.log|console.error|console.warn containing variable names
     that suggest secrets (key, token, secret, password, dsn)

REPORT FORMAT per finding:
| Severity | File | Line | Code Snippet | Issue | Fix |

==========================================================
CATEGORY 2: AUTHENTICATION & AUTHORIZATION GAPS
==========================================================

SCAN FOR:
1. Edge Functions without JWT validation
   - For every supabase/functions/*/index.ts:
     Check if it extracts/validates auth token from request headers.
     Flag any function that does NOT validate auth (except public endpoints).

2. API routes without auth middleware (admin portal)
   - For every p2p-kids-admin/src/app/api/**/route.ts:
     Check if it validates admin identity (session, secret header, or JWT).
     Flag any unprotected route.

3. Client components using service role key
   - grep for 'use client' files that import or reference service_role
   - Any match = P0

4. Inconsistent admin auth patterns
   - List every auth checking pattern used across admin API routes
   - Flag if more than ONE pattern exists (inconsistency = security risk)

5. Missing RBAC checks
   - Look for admin-only operations that skip is_admin() or role check

6. Session handling weaknesses
   - Check: token refresh logic, logout cleanup, session persistence

REPORT FORMAT per finding:
| Severity | File | Line | Auth Method Used | Issue | Fix |

==========================================================
CATEGORY 3: RLS POLICY AUDIT (Supabase)
==========================================================

SCAN FOR:
1. Tables with RLS DISABLED
   - Read every CREATE TABLE in migrations
   - For each table, check if ALTER TABLE ... ENABLE ROW LEVEL SECURITY exists
   - ALSO check for any ALTER TABLE ... DISABLE ROW LEVEL SECURITY
   - Flag any table without RLS enabled

2. Overly permissive policies
   - grep: USING\s*\(\s*true\s*\) or WITH CHECK\s*\(\s*true\s*\)
   - For each match, check the role — USING(true) for service_role is OK
   - USING(true) for authenticated or anon = P1

3. Anon access policies
   - grep: TO anon or TO public (not TO authenticated or TO service_role)
   - Flag any table with anon write access (INSERT/UPDATE/DELETE) as P0
   - Flag any table with sensitive data + anon read access as P1

4. Missing node isolation
   - For tables with node_id column: check if RLS policies include node_id check
   - Flag if only user_id is checked but node_id is not

5. SECURITY DEFINER functions without search_path
   - grep: SECURITY DEFINER in all .sql files
   - Check if SET search_path = public follows
   - Flag any SECURITY DEFINER without explicit search_path

REPORT FORMAT per finding:
| Severity | Table/Function | Migration File | Policy/Issue | Fix |

==========================================================
CATEGORY 4: INPUT VALIDATION & INJECTION
==========================================================

SCAN FOR:
1. SQL injection vectors
   - grep for string concatenation in SQL queries: `\$\{.*\}` inside sql`` or .query()
   - grep for raw SQL with user input: any .rpc() call where params come from req.body
   - Flag any non-parameterized query

2. XSS vectors (admin portal)
   - grep for dangerouslySetInnerHTML
   - grep for innerHTML assignments
   - Check if user-generated content (listing titles, messages, usernames)
     is rendered without sanitization

3. Missing input validation in Edge Functions
   - For each Edge Function: check if request body is validated before use
   - Look for Zod, joi, or manual validation
   - Flag functions that use req.json() directly without schema validation

4. Missing input validation in API routes (admin portal)
   - Same check for p2p-kids-admin/src/app/api/**/route.ts files

5. File upload validation
   - Check if image uploads validate: MIME type, file size, file extension
   - Check for path traversal in upload paths

REPORT FORMAT per finding:
| Severity | File | Line | Issue | Attack Vector | Fix |

==========================================================
CATEGORY 5: DEPENDENCY VULNERABILITIES
==========================================================

SCAN FOR:
1. Run (or document command for) npm audit for both apps:
   - cd p2p-kids-marketplace && npm audit --json 2>/dev/null | head -50
   - cd p2p-kids-admin && npm audit --json 2>/dev/null | head -50

2. Check for known vulnerable package versions:
   - Any lodash <4.17.21
   - Any axios <1.6.0
   - Any @supabase/supabase-js <2.39.0
   - Any next <14.1.0
   - Any react-native <0.73 (if applicable)

3. Check for unnecessary dependencies
   - Look for packages imported nowhere in src/
   - Flag bloat that increases attack surface

4. Check for pinned vs floating versions
   - Flag any dependency version starting with * or >= (too permissive)

REPORT FORMAT per finding:
| Severity | App | Package | Installed Version | Issue | Fix |

==========================================================
CATEGORY 6: ERROR HANDLING & CRASH RESILIENCE
==========================================================

SCAN FOR:
1. Unhandled promise rejections
   - grep for: async functions without try/catch wrapping
   - grep for: .then() without .catch()
   - grep for: await without surrounding try/catch in screen components

2. Silent error swallowing
   - grep for: catch\s*\(.*\)\s*\{\s*\} (empty catch blocks)
   - grep for: catch\s*\(.*\)\s*\{\s*return\s*(null|undefined|void)
   - Flag any catch that doesn't log or rethrow

3. Missing Error Boundary
   - Check if a React Error Boundary wraps the app root
   - Check if individual stack navigators have error boundaries

4. Missing loading states
   - For each screen that fetches data: does it show a loading indicator?
   - grep for: useEffect with fetch/supabase calls — check for isLoading state

5. Crash on undefined access
   - grep for: \.data\. without optional chaining (data?.field)
   - grep for: navigation params accessed without defaults

REPORT FORMAT per finding:
| Severity | File | Line | Issue | Impact | Fix |

==========================================================
CATEGORY 7: iOS & ANDROID STORE COMPLIANCE
==========================================================

SCAN FOR:
1. iOS Privacy Descriptions
   - Read app.json → ios.infoPlist
   - Check for ALL required NS*UsageDescription keys:
     NSCameraUsageDescription, NSPhotoLibraryUsageDescription,
     NSLocationWhenInUseUsageDescription, NSPhotoLibraryAddUsageDescription
   - Missing = P0 (hard reject)

2. PrivacyInfo.xcprivacy / Privacy Manifest
   - Check app.json → ios.privacyManifests
   - Missing = P0 (hard reject since Spring 2024)

3. Android Target SDK
   - Check app.json → android.targetSdkVersion
   - Must be >= 34 for current Play Store requirements

4. COPPA / Kids App Compliance
   - Check for advertising SDKs (AdMob, Facebook Ads, etc.) — forbidden in kids apps
   - Check Firebase Analytics config for COPPA mode
   - Check for age gating / parental consent enforcement
   - Check for external links without parental gate

5. App Transport Security / HTTPS
   - Check for any http:// URLs (not https://) in source code
   - Flag any non-secure network call

6. Debug / Test Code in Production
   - grep for: __DEV__ used correctly (code should be stripped in prod)
   - grep for: console.log that would spam production logs
   - grep for: test users, hardcoded test data, TODO comments about removing test code

REPORT FORMAT per finding:
| Severity | Category | File | Line | Issue | Store Impact | Fix |

==========================================================
CATEGORY 8: DATA PRIVACY & COPPA
==========================================================

SCAN FOR:
1. PII in logs
   - grep for console.log/error/warn that output: email, phone, name, dob, address
   - Also check Sentry config: sendDefaultPii must be false

2. PII in analytics events
   - Check all analytics.track() or logEvent() calls
   - Flag any that send email, name, phone, or DOB as event properties

3. Data minimization
   - Check what profile data is fetched on every screen load
   - Flag if full profile (including DOB, phone) is loaded unnecessarily

4. Parental consent enforcement
   - Verify server-side COPPA check (not just UI)
   - Check if under-13 users can bypass consent by calling APIs directly

5. Data retention
   - Check for any soft-delete mechanism (deleted_at columns)
   - Check if there's any scheduled cleanup for old data
   - GDPR/COPPA requires ability to delete user data on request

REPORT FORMAT per finding:
| Severity | File | Line | Data Type | Issue | Fix |

==========================================================
CATEGORY 9: PERFORMANCE & RESOURCE LEAKS
==========================================================

SCAN FOR:
1. Memory leaks in React components
   - grep for: addEventListener without removeEventListener
   - grep for: setInterval/setTimeout without cleanup in useEffect return
   - grep for: Supabase .subscribe() without .unsubscribe() in cleanup

2. N+1 query patterns
   - Check Edge Functions for queries inside loops
   - Check screen components that fetch list + detail in sequence

3. Missing pagination
   - Check any .select('*') without .range() or .limit()
   - Flag any unbounded query

4. Large bundle concerns
   - Check for large imports (moment.js, lodash full import)
   - Prefer: date-fns, lodash-es or individual lodash function imports

5. Image optimization
   - Check if images are resized before upload
   - Check if thumbnails are generated or if full images are loaded in lists

REPORT FORMAT per finding:
| Severity | File | Line | Issue | Impact | Fix |

==========================================================
CATEGORY 10: CONFIGURATION & BUILD
==========================================================

SCAN FOR:
1. Missing or stale .env.example files
   - Compare actual env vars used in code vs documented in .env.example
   - Flag any env var used but not documented

2. TypeScript strictness
   - Read tsconfig.json for both apps
   - Flag: noImplicitAny: false, strictNullChecks: false, strict: false

3. Build configuration
   - eas.json: verify dev/staging/production profiles
   - next.config.js: check for security headers, image domains

4. Git hygiene
   - Check .gitignore covers: .env*, node_modules, .next, ios/Pods, android/.gradle
   - Check for any large binary files tracked

==========================================================
OUTPUT FORMAT
==========================================================

The output file MUST be: docs/PROD-SCAN-FINDINGS.md

Structure:
# Production Readiness & Security Scan Report
**Date:** [auto-fill]
**Scanned Apps:** p2p-kids-marketplace (mobile), p2p-kids-admin (admin portal)
**Scanned Infra:** supabase/ (migrations + Edge Functions), infra/, scripts/

## Executive Summary
- Total Findings: X
- P0 (Blockers): X
- P1 (High): X
- P2 (Medium): X
- P3 (Low/Info): X

## Findings by Category

### 1. Secrets & Environment Variable Leaks
(table of findings)

### 2. Authentication & Authorization Gaps
(table of findings)

... (all 10 categories)

## Appendix: Commands Used
(list every grep/search command used so the scan is reproducible)

## Appendix: Files Scanned
(count of files scanned per directory)
```

---

### Execution Steps for the AI Agent

The agent MUST execute these steps in order:

**Step 1: Discovery (15 min)**
1. List all directories in both apps to understand current structure
2. Count total files per directory
3. Read both package.json files for dependency list
4. Read both tsconfig.json files
5. Read app.json for mobile app configuration

**Step 2: Category 1-3 Scans — Secrets, Auth, RLS (60 min)**
6. Run all grep patterns for secrets leaks across both apps
7. Read every Edge Function's index.ts to check auth validation
8. Read every admin API route to check auth middleware
9. Read all SQL migrations and catalog RLS policies by table

**Step 3: Category 4-6 Scans — Validation, Deps, Error Handling (60 min)**
10. Check every Edge Function for input validation
11. Run npm audit (or read package-lock for known vulns)
12. Grep for empty catch blocks, unhandled promises, missing loading states

**Step 4: Category 7-8 Scans — Store Compliance, Privacy (45 min)**
13. Verify all iOS/Android privacy requirements in app.json
14. Grep for PII in logs and analytics calls
15. Check COPPA enforcement (server-side)

**Step 5: Category 9-10 Scans — Performance, Config (30 min)**
16. Check for memory leaks, N+1 queries, unbounded queries
17. Verify build config, TypeScript strictness, .gitignore

**Step 6: Report Generation (30 min)**
18. Compile all findings into docs/PROD-SCAN-FINDINGS.md
19. Calculate severity distribution
20. Write executive summary

---

### Acceptance Criteria

- [ ] `docs/PROD-SCAN-FINDINGS.md` exists and is non-empty
- [ ] Report covers ALL 10 categories — no category skipped
- [ ] Every finding has: file path, line number, code snippet, severity, fix recommendation
- [ ] P0 findings are clearly separated and highlighted
- [ ] Findings are deduplicated (same issue in multiple files = one finding with all locations)
- [ ] Report includes summary counts by severity
- [ ] Report includes reproducible grep commands in appendix
- [ ] Report includes file scan counts in appendix
- [ ] Both apps covered: p2p-kids-marketplace AND p2p-kids-admin
- [ ] Supabase migrations/functions covered
- [ ] No false positives from node_modules, lock files, or build artifacts
- [ ] Report is formatted in clean, readable Markdown tables

---

### Output Files

1. **docs/PROD-SCAN-FINDINGS.md** — The complete scan report

---

### Testing Steps

1. **Verify report exists and is substantial:**
   - `wc -l docs/PROD-SCAN-FINDINGS.md` → should be 200+ lines
   - `grep -c "| P0" docs/PROD-SCAN-FINDINGS.md` → should show P0 count

2. **Verify all categories covered:**
   - `grep -c "### " docs/PROD-SCAN-FINDINGS.md` → should be >= 10

3. **Verify actionability:**
   - Every finding should have a non-empty "Fix" column
   - No vague advice ("consider improving...") — only specific actions

4. **Cross-reference with known issues:**
   - Verify the scan catches the known issues from the MODULE-15.5 blocking issues table
   - If any known issue is MISSED, the scan is incomplete

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Directory discovery + file inventory | 15 min |
| Secrets & env variable scan | 30 min |
| Auth & authorization scan | 45 min |
| RLS policy audit | 30 min |
| Input validation scan | 30 min |
| Dependency audit | 15 min |
| Error handling scan | 20 min |
| Store compliance check | 30 min |
| Data privacy / COPPA scan | 20 min |
| Performance & config scan | 15 min |
| Report compilation + executive summary | 30 min |
| **Total** | **~5 hours** |

---

---

## SUMMARY: Task Dependency Graph

```
★ PROD-013 (Full-Stack Scan)      — No dependencies (RUN FIRST)
    │
    ▼ (Scan findings inform priority order of all tasks below)
    │
PROD-P001 (iOS Privacy)           — No dependencies
PROD-P002 (Service Role Key Fix)  — No dependencies  
PROD-P003 (Error Boundary)        — No dependencies
PROD-P004 (Sentry)                — Depends on PROD-P003
PROD-P005 (COPPA Enforcement)     — No dependencies
    │
    ▼ (All prerequisites must be done before main tasks)
    │
PROD-001 (SP Wallet RLS)          — No dependencies
PROD-002 (admin_config RLS)       — No dependencies
PROD-003 (Rate Limiting)          — No dependencies
PROD-004 (Node Isolation RLS)     — After PROD-001
PROD-005 (Stripe Ownership)       — No dependencies
PROD-006 (noImplicitAny)          — No dependencies (parallel)
PROD-007 (Fix Lint)               — After PROD-006
PROD-008 (Fix Tests)              — After PROD-006, PROD-007
PROD-009 (Store Metadata)         — After PROD-P001
PROD-010 (Admin Auth Consolidation) — After PROD-P002
PROD-011 (Google Play Compliance) — After PROD-P001, PROD-009
PROD-012 (Secret Audit)           — After PROD-P002
```

---

## Recommended Execution Order

### Day 0: Full-Stack Scan (Run FIRST)
| Day | Task | Hours | Why First |
|-----|------|-------|-----------|
| 0 | PROD-013 (Full-Stack Scan) | 5h | Discovers ALL issues across both apps; findings inform prioritization of every other task |

### Week 1: P0 Blockers (Prerequisites)
| Day | Task | Hours | Why First |
|-----|------|-------|-----------|
| 1 | PROD-P001 (iOS Privacy) | 2h | App Store hard reject |
| 1 | PROD-P002 (Service Role Key) | 4h | Critical security vulnerability |
| 2 | PROD-P003 (Error Boundary) | 2h | Crash prevention |
| 2 | PROD-P004 (Sentry) | 3h | Crash visibility |
| 3 | PROD-P005 (COPPA) | 4h | Legal requirement for kids app |

### Week 2: P1 Security + Store Requirements
| Day | Task | Hours | Why |
|-----|------|-------|-----|
| 1 | PROD-001 (SP Wallet RLS) | 2h | Financial data security |
| 1 | PROD-002 (admin_config RLS) | 1.5h | Config data security |
| 2 | PROD-003 (Rate Limiting) | 4h | Abuse prevention |
| 3 | PROD-004 (Node Isolation) | 3h | Data isolation |
| 3 | PROD-005 (Stripe Ownership) | 2h | Payment security |

### Week 3: P2 Quality + Store Submission
| Day | Task | Hours | Why |
|-----|------|-------|-----|
| 1-2 | PROD-006 (noImplicitAny) | 6h | Type safety |
| 2 | PROD-007 (Fix Lint) | 3h | Code quality |
| 3 | PROD-008 (Fix Tests) | 4h | CI/CD gate |
| 3 | PROD-009 (Store Metadata) | 3h | Submission prep |
| 4 | PROD-010 (Admin Auth) | 3h | Auth consolidation |
| 4 | PROD-011 (Google Play) | 2h | Android submission |
| 4 | PROD-012 (Secret Audit) | 2h | Final security check |

---

## Final Verification: Production Readiness Score

After completing all tasks, verify the target score by confirming:

| Category | Weight | Before | Target | Verification |
|----------|--------|--------|--------|-------------|
| Full-Stack Scan Baseline | — | — | — | PROD-013 (findings drive all other tasks) |
| Security (no leaked secrets, proper RLS, rate limits) | 25% | 4/10 | 9/10 | PROD-P002, 001-005, 012 |
| Crash Resilience (ErrorBoundary, Sentry) | 15% | 2/10 | 9/10 | PROD-P003, P004 |
| Store Compliance (privacy, COPPA, metadata) | 20% | 3/10 | 9/10 | PROD-P001, P005, 009, 011 |
| Type Safety & Code Quality (TS strict, lint, tests) | 15% | 5/10 | 9/10 | PROD-006, 007, 008 |
| Auth & Access Control (admin auth, RLS) | 15% | 5/10 | 9/10 | PROD-001-004, 010 |
| Environment & Secrets (proper env config) | 10% | 6/10 | 10/10 | PROD-P002, 012 |
| **Weighted Total** | **100%** | **~6.5/10** | **~9.2/10** | |

### Post-Completion Commands (run ALL before submission)

```bash
# Mobile App
cd p2p-kids-marketplace
npx tsc --noEmit                    # TypeScript compilation — exit code 0
npx eslint src/                      # Lint — exit code 0
npx jest                             # Tests — exit code 0
npx expo prebuild --platform ios     # iOS build — no errors
npx expo prebuild --platform android # Android build — no errors

# Admin Portal
cd ../p2p-kids-admin
npx tsc --noEmit                    # TypeScript compilation — exit code 0
yarn build                           # Next.js build — exit code 0
grep -r "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY" src/ # — ZERO results

# Security Verification
grep -r "service_role" p2p-kids-admin/.next/static/ # — ZERO results
# Supabase: verify no anon policies on sp_wallets
# SELECT count(*) FROM pg_policies WHERE tablename = 'sp_wallets' AND roles::text LIKE '%anon%';
# Expected: 0
```
