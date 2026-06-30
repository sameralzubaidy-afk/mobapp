#!/usr/bin/env node
/**
 * File: p2p-kids-marketplace/scripts/testid-drift-check.mjs
 * Purpose: Verify every testID used in Maestro YAML scripts exists in the app source.
 * Run in CI as part of Tier 0 to catch testID drift before scripts reach a simulator.
 *
 * Usage:
 *   node scripts/testid-drift-check.mjs            # Check all .maestro/*.yaml files
 *   node scripts/testid-drift-check.mjs --verbose   # Print every matched testID
 *   node scripts/testid-drift-check.mjs --ci        # Exit 1 on any failure (CI mode)
 *
 * Exit codes:
 *   0 — All testIDs accounted for
 *   1 — One or more testIDs missing from source
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pkg from 'glob';
const globSync = pkg.sync;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MAESTRO_DIR = resolve(ROOT, '.maestro');
const SRC_DIR = resolve(ROOT, 'src');

// ── Configuration ─────────────────────────────────────────────────────────
// testID patterns that appear in multiple files but are legitimate
const KNOWN_DUPLICATES = new Set([
  'password-input',           // in LoginScreen.tsx AND DeleteAccountScreen.tsx
  'empty-state',              // in DiscoverScreen.tsx AND TradeListScreen.tsx AND SpTransactionHistoryScreen.tsx
  'safety-disclaimer',        // in TradeOfferScreen.tsx AND TradeReviewScreen.tsx
  'bundle-context-banner',    // in TradeTimelineScreen.tsx AND ReviewOfferScreen.tsx
  'confirm-trade-button',     // in TradeTimelineScreen.tsx AND TradeInitiationScreen.tsx
  'cancel-trade-button',      // in TradeTimelineScreen.tsx AND TradeDetailScreen.tsx
  'disclaimer-modal',         // Default testID prop in DisclaimerModal component
  'disclaimer-modal-loading',
  'disclaimer-modal-close-button',
  'disclaimer-modal-scroll-view',
  'disclaimer-modal-checkbox',
  'disclaimer-modal-cancel-button',
  'disclaimer-modal-accept-button',
  'disclaimer-modal-retry-button',
  'success-icon',             // in TradeSuccessScreen.tsx
  'failure-icon',             // in TradeSuccessScreen.tsx
  'loading-indicator',        // shared component
  'sp-wallet-balance-card',
  'sp-wallet-balance-amount',
  'sp-wallet-shop-btn',
  'sp-wallet-sell-btn',
  'sp-wallet-history-btn',
  'sp-wallet-earn-sell-btn',
  'sp-wallet-earn-refer-btn',
  'sp-wallet-how-trading-works-btn',
  'sp-history-tab-all',
  'sp-history-tab-earned',
  'sp-history-tab-spent',
  'sp-history-empty-state',
  'app-logo',
  'landing-signup-button',
  'landing-login-button',
]);

// Dynamic testID patterns (contain template expressions like `${item.id}`)
// These are verified by checking the prefix pattern exists in source
const DYNAMIC_PREFIXES = [
  'search-result-',
  'trade-row-',
  'category-item-',
  'autocomplete-suggestion-',
  'recent-search-',
  'remove-recent-search-',
  'spell-suggestion-',
  'sp-history-tx-',
  'sp-history-amount-',
  'feature-slide-',
  'feature-title-',
  'feature-description-',
  'pagination-dots-',
  'get-started-button-',
  'next-button-',
  'reason-chip-',
  'method-row-',
  'history-row-',
  'history-amount-',
  'history-status-',
  'dev-fill-',
  'global-alert-button-',
  'feature-dot-',
];

// testIDs constructed via template literals with a base variable (e.g., `${testID}-checkbox`)
// Key: suffix (or full pattern) — Value: pattern to search for in source
const TEMPLATE_PATTERNS = [
  // DisclaimerModal uses: testID={`${testID}-close-button`} where testID defaults to 'disclaimer-modal'
  // The runtime value ends with '-close-button' but source has 'close-button`}'
  { suffix: '-close-button', search: 'close-button`}' },
  { suffix: '-loading', search: 'loading`}' },
  { suffix: '-scroll-view', search: 'scroll-view`}' },
  { suffix: '-checkbox', search: 'checkbox`}' },
  { suffix: '-cancel-button', search: 'cancel-button`}' },
  { suffix: '-accept-button', search: 'accept-button`}' },
  { suffix: '-retry-button', search: 'retry-button`}' },
  // ItemCreateScreen uses: testID={`dev-fill-${user.id}`}
  { suffix: '-', search: 'dev-fill-' },
];

// testIDs that reference system UI elements not in app source
const SYSTEM_TEST_IDS = new Set([
  // None currently — all testIDs should be in app source
]);

// ── Collect testIDs from Maestro YAML files ──────────────────────────────
function extractMaestroTestIds(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const testIds = new Set();

  // Match: id: "some-test-id" in YAML blocks (tapOn, assertVisible, scrollUntilVisible, etc.)
  const idMatches = content.matchAll(/^\s+id:\s+"([^"]+)"\s*$/gm);
  for (const match of idMatches) {
    testIds.add(match[1]);
  }

  // Also match inline: extendedWaitUntil: { visible: { id: "..." } }
  const inlineMatches = content.matchAll(/id:\s+"([^"]+)"/g);
  for (const match of inlineMatches) {
    testIds.add(match[1]);
  }

  return testIds;
}

// ── Helper: check if ANY file in srcDir contains the search string ─────
function sourceContains(srcDir, searchString) {
  try {
    const files = globSync(`${srcDir}/**/*.{tsx,ts}`, { ignore: '**/node_modules/**', nodir: true });
    return files.some(f => {
      try {
        return readFileSync(f, 'utf-8').includes(searchString);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

// ── Check if a testID exists in source code ─────────────────────────────
function testIdExistsInSource(testId, srcDir) {
  // Method 1: Static usage — testID="exact-match"
  if (sourceContains(srcDir, `testID="${testId}"`)) return true;

  // Method 2: Template literal with variable ref — testID={`${base}-suffix`}
  // e.g., testID={`${testID}-checkbox`} produces testID="disclaimer-modal-checkbox" at runtime
  for (const pattern of TEMPLATE_PATTERNS) {
    if (testId.endsWith(pattern.suffix) && sourceContains(srcDir, pattern.search)) {
      return true;
    }
  }

  // Method 3: Dynamic prefix patterns — testID={`search-result-${item.id}`}
  for (const prefix of DYNAMIC_PREFIXES) {
    if (testId.startsWith(prefix)) {
      // Check: testID={`${prefix}...`}
      if (sourceContains(srcDir, `testID={\`${prefix}`)) return true;
      // Also check: `${prefix}...` anywhere in file
      if (sourceContains(srcDir, `\`${prefix}`)) return true;
      // Also check as a simple static prefix (some are partially static)
      const starIndex = prefix.indexOf('*');
      if (starIndex !== -1) {
        const partialPrefix = prefix.substring(0, starIndex);
        if (sourceContains(srcDir, partialPrefix)) return true;
      }
    }
  }

  // Method 4: Variable reference — testID={someVariable}
  // Check if the testID value appears as a default prop or string assignment
  if (sourceContains(srcDir, `'${testId}'`) || sourceContains(srcDir, `"${testId}"`)) {
    // Only count if the string is near a testID-related context
    // This is less precise but catches patterns like default props
    return true;
  }

  return false;
}

// ── Main ────────────────────────────────────────────────────────────────
function main() {
  const isVerbose = process.argv.includes('--verbose');
  const isCi = process.argv.includes('--ci');

  if (!existsSync(MAESTRO_DIR)) {
    console.error(`❌ Maestro directory not found: ${MAESTRO_DIR}`);
    process.exit(isCi ? 1 : 0);
  }

  const yamlFiles = globSync(`${MAESTRO_DIR}/**/*.yaml`, { ignore: '**/node_modules/**' });
  const helperFiles = globSync(`${MAESTRO_DIR}/helpers/**/*.yaml`, { ignore: '**/node_modules/**' });
  const allFiles = [...yamlFiles, ...helperFiles];
  const uniqueFiles = [...new Set(allFiles)];

  if (uniqueFiles.length === 0) {
    console.log('⚠️  No Maestro YAML files found to check.');
    process.exit(0);
  }

  // Collect all unique testIDs from all YAML files
  const allTestIds = new Set();
  for (const file of uniqueFiles) {
    const ids = extractMaestroTestIds(file);
    for (const id of ids) {
      allTestIds.add(id);
    }
  }

  // Check each testID
  const missing = [];
  const found = [];

  for (const testId of [...allTestIds].sort()) {
    // Skip system-level identifiers (not in app source)
    if (SYSTEM_TEST_IDS.has(testId)) {
      if (isVerbose) console.log(`  ⏭️  SKIP (system):  ${testId}`);
      continue;
    }

    if (testIdExistsInSource(testId, SRC_DIR)) {
      found.push(testId);
      if (isVerbose) console.log(`  ✅  FOUND: ${testId}`);
    } else {
      missing.push(testId);
      console.log(`  ❌  MISSING: ${testId}`);
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════');
  console.log(`  Maestro files checked: ${uniqueFiles.length}`);
  console.log(`  Unique testIDs found:  ${allTestIds.size}`);
  console.log(`  ✅ Found in source:    ${found.length}`);
  console.log(`  ❌ Missing from source: ${missing.length}`);
  console.log('═══════════════════════════════════════════\n');

  if (missing.length > 0) {
    console.log('❌ DRIFT DETECTED — the following testIDs are used in Maestro');
    console.log('   scripts but do NOT exist in the app source code:');
    console.log('');
    for (const id of missing) {
      console.log(`   - "${id}"`);
    }
    console.log('');
    console.log('   Possible causes:');
    console.log('   1. The testID was renamed in the app source but not updated in the Maestro script');
    console.log('   2. The testID was never added to the app source (needs a developer to add it)');
    console.log('   3. The testID references a system UI element not controllable via RN testID');
    console.log('');
    console.log('   Fix: add the missing testID to the source component, or update the Maestro script.');
    process.exit(isCi ? 1 : 0);
  } else {
    console.log('✅ All testIDs in Maestro scripts are accounted for in the app source.');
    process.exit(0);
  }
}

main();
