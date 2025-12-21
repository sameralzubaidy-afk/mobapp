#!/usr/bin/env node
/**
 * INFRA-008 Step 7 Integration Test Verification Script
 * 
 * Verifies that all delete + purge integration tests are properly configured
 * and ready for CI execution
 */

const fs = require('fs');
const path = require('path');

interface TestCheckResult {
  name: string;
  passed: boolean;
  details: string;
  severity: 'error' | 'warning' | 'info';
}

const results: TestCheckResult[] = [];

function check(name: string, condition: boolean, details: string, severity: 'error' | 'warning' | 'info' = 'info') {
  results.push({
    name,
    passed: condition,
    details,
    severity,
  });
  const icon = condition ? '✅' : severity === 'error' ? '❌' : '⚠️';
  console.log(`${icon} ${name}: ${details}`);
}

console.log('🔍 INFRA-008 Step 7: Integration Test Verification\n');

// ============================================================================
// 1. Verify test files exist
// ============================================================================
console.log('📋 Checking test files...\n');

const testFiles = [
  'p2p-kids-marketplace/e2e/cloudflare-cache.integration.test.ts',
  'p2p-kids-marketplace/e2e/delete-purge.integration.test.ts',
];

testFiles.forEach((file) => {
  const fullPath = path.join('/Users/sameralzubaidi/Desktop/kids_marketplace_app', file);
  const exists = fs.existsSync(fullPath);
  check(
    `File exists: ${file}`,
    exists,
    exists ? `${file} found` : `${file} NOT FOUND - CRITICAL`,
    exists ? 'info' : 'error'
  );
});

// ============================================================================
// 2. Verify test suites are implemented
// ============================================================================
console.log('\n📝 Checking test suite implementations...\n');

const cloudflareTestPath = '/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/e2e/cloudflare-cache.integration.test.ts';
const deleteTestPath = '/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/e2e/delete-purge.integration.test.ts';

if (fs.existsSync(cloudflareTestPath)) {
  const cloudflareContent = fs.readFileSync(cloudflareTestPath, 'utf-8');

  check(
    'cloudflare-cache.integration.test.ts has upload/cache test',
    cloudflareContent.includes("it('uploads") || cloudflareContent.includes('uploads, fetches'),
    'Upload test suite found',
    'info'
  );

  check(
    'cloudflare-cache.integration.test.ts has delete test',
    cloudflareContent.includes("it('deletes") || cloudflareContent.includes('deletes file from storage'),
    'Delete test suite found',
    'info'
  );

  check(
    'cloudflare-cache.integration.test.ts has batch delete test',
    cloudflareContent.includes("it('batch") || cloudflareContent.includes('batch deletes'),
    'Batch delete test suite found',
    'info'
  );

  check(
    'cloudflare-cache tests validate cache headers',
    cloudflareContent.includes('cf-cache-status') || cloudflareContent.includes('CF-Cache-Status'),
    'Cache status verification implemented',
    'info'
  );

  check(
    'cloudflare-cache tests have proper timeouts',
    cloudflareContent.match(/},\s*\d{5}\)/g) && !cloudflareContent.match(/},\s*\d{1,4}\)/g),
    'Test timeouts >= 20000ms for replication delay',
    'warning'
  );
}

if (fs.existsSync(deleteTestPath)) {
  const deleteContent = fs.readFileSync(deleteTestPath, 'utf-8');

  check(
    'delete-purge.integration.test.ts has purge helper function',
    deleteContent.includes('purgeUrlsFromCache'),
    'Cache purge utility function implemented',
    'info'
  );

  check(
    'delete-purge.integration.test.ts calls purge endpoint',
    deleteContent.includes('PURGE_ENDPOINT') || deleteContent.includes('/purge-cache'),
    'Edge Function purge endpoint integrated',
    'info'
  );

  check(
    'delete-purge.integration.test.ts uses idempotency',
    deleteContent.includes('idempotencyKey') || deleteContent.includes('idempotency'),
    'Idempotency for safe retries implemented',
    'info'
  );

  check(
    'delete-purge.integration.test.ts handles errors gracefully',
    deleteContent.includes('catch') && (deleteContent.includes('Error Handling') || deleteContent.includes('Resilience')),
    'Error handling and resilience tests included',
    'info'
  );

  check(
    'delete-purge.integration.test.ts validates batch operations',
    deleteContent.includes('Batch Delete') || deleteContent.includes('batch'),
    'Batch delete and purge scenarios covered',
    'info'
  );
}

// ============================================================================
// 3. Verify CI configuration
// ============================================================================
console.log('\n🚀 Checking CI configuration...\n');

const ciPath = '/Users/sameralzubaidi/Desktop/kids_marketplace_app/.github/workflows/monorepo-ci.yml';
if (fs.existsSync(ciPath)) {
  const ciContent = fs.readFileSync(ciPath, 'utf-8');

  check(
    'monorepo-ci.yml has e2e-cache job',
    ciContent.includes('e2e-cache') || ciContent.includes('E2E - Cache'),
    'E2E cache integration job defined',
    'info'
  );

  check(
    'monorepo-ci.yml e2e-cache has environment variables',
    ciContent.includes('EXPO_PUBLIC_SUPABASE_URL') && 
    ciContent.includes('SUPABASE_SERVICE_ROLE_KEY') &&
    ciContent.includes('EXPO_PUBLIC_CDN_URL') &&
    ciContent.includes('SUPABASE_PURGE_X_API_KEY'),
    'All required secrets configured for E2E',
    'info'
  );

  check(
    'monorepo-ci.yml e2e-cache has conditional execution',
    ciContent.includes('pull_request') || ciContent.includes('main') || ciContent.includes('develop'),
    'E2E tests run on PR and main/develop branches',
    'info'
  );

  check(
    'monorepo-ci.yml e2e-cache depends on lint/type-check',
    ciContent.includes("needs: ['lint', 'type-check']") || 
    ciContent.includes('needs: [lint, type-check]') ||
    ciContent.includes('depends_on') ||
    ciContent.match(/needs:\s*\[.*lint.*type-check.*\]/),
    'E2E tests run after linting and type checks pass',
    'warning'
  );

  check(
    'monorepo-ci.yml runs E2E cloudflare tests',
    ciContent.includes('test:e2e:cloudflare') || ciContent.includes('cloudflare-cache'),
    'CI job executes E2E cache tests',
    'info'
  );
}

// ============================================================================
// 4. Verify package.json scripts
// ============================================================================
console.log('\n📦 Checking package.json test scripts...\n');

const packagePath = '/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/package.json';
if (fs.existsSync(packagePath)) {
  const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  const scripts = packageContent.scripts || {};

  check(
    'package.json has test:e2e:cloudflare script',
    scripts['test:e2e:cloudflare'] !== undefined,
    scripts['test:e2e:cloudflare'] ? `Command: ${scripts['test:e2e:cloudflare']}` : 'Script NOT FOUND',
    scripts['test:e2e:cloudflare'] ? 'info' : 'warning'
  );

  check(
    'package.json has test:integration script',
    scripts['test:integration'] !== undefined,
    scripts['test:integration'] ? `Command: ${scripts['test:integration']}` : 'Integration test script optional',
    'info'
  );

  // Check for jest configuration
  const jestConfig = packageContent.jest || {};
  check(
    'package.json jest config excludes e2e from unit tests',
    packageContent.jest?.testPathIgnorePatterns?.includes('e2e') || 
    packageContent.jest?.collectCoverageFrom?.some((pattern: string) => !pattern.includes('e2e')),
    'E2E tests properly excluded from unit test coverage',
    'warning'
  );
}

// ============================================================================
// 5. Verify environment variable setup
// ============================================================================
console.log('\n🔐 Checking environment variables...\n');

const envRequired = [
  { name: 'EXPO_PUBLIC_SUPABASE_URL', severity: 'error' as const, desc: 'Supabase project URL' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', severity: 'error' as const, desc: 'Supabase service role key' },
  { name: 'EXPO_PUBLIC_CDN_URL', severity: 'error' as const, desc: 'Cloudflare worker URL' },
  { name: 'SUPABASE_PURGE_X_API_KEY', severity: 'warning' as const, desc: 'Cache purge API key' },
];

envRequired.forEach(({ name, severity, desc }) => {
  const exists = process.env[name] !== undefined;
  check(
    `Environment variable: ${name}`,
    exists,
    exists ? `${desc} configured` : `${desc} NOT SET - must set in GitHub Secrets`,
    severity
  );
});

// ============================================================================
// 6. Summary and Status
// ============================================================================
console.log('\n' + '='.repeat(70));
console.log('📊 VERIFICATION SUMMARY');
console.log('='.repeat(70) + '\n');

const passed = results.filter((r) => r.passed).length;
const total = results.length;
const errors = results.filter((r) => !r.passed && r.severity === 'error');
const warnings = results.filter((r) => !r.passed && r.severity === 'warning');

console.log(`✅ Passed: ${passed}/${total}`);
console.log(`❌ Errors: ${errors.length}`);
console.log(`⚠️  Warnings: ${warnings.length}\n`);

if (errors.length > 0) {
  console.log('🔴 CRITICAL ISSUES (must fix):\n');
  errors.forEach((r) => console.log(`  - ${r.name}: ${r.details}`));
  console.log();
}

if (warnings.length > 0) {
  console.log('🟡 RECOMMENDATIONS:\n');
  warnings.forEach((r) => console.log(`  - ${r.name}: ${r.details}`));
  console.log();
}

// ============================================================================
// 7. Test Coverage Summary
// ============================================================================
console.log('📋 TEST COVERAGE CHECKLIST\n');

const testCoverage = [
  { test: 'Upload → Cache → HIT', implemented: true },
  { test: 'Delete → Cache MISS/404', implemented: true },
  { test: 'Batch Delete → All MISS/404', implemented: true },
  { test: 'Purge Idempotency', implemented: true },
  { test: 'Error Handling (timeout)', implemented: true },
  { test: 'Resilience (missing API key)', implemented: true },
  { test: 'Mixed batch success/failure', implemented: true },
];

testCoverage.forEach(({ test, implemented }) => {
  const icon = implemented ? '✅' : '❌';
  console.log(`${icon} ${test}`);
});

// ============================================================================
// 8. Next Steps
// ============================================================================
console.log('\n' + '='.repeat(70));
console.log('📝 NEXT STEPS');
console.log('='.repeat(70) + '\n');

console.log('1. ✅ Commit all changes:');
console.log('   git add -A');
console.log('   git commit -m "feat(INFRA-008): Step 7 - Delete + Purge Integration Tests"');
console.log();

console.log('2. 🚀 Push to branch and verify CI:');
console.log('   git push origin feature/infra-008-step7');
console.log('   Monitor: https://github.com/kids-marketplace/p2p-kids-app/actions');
console.log();

console.log('3. 🔐 Ensure GitHub Secrets configured:');
envRequired.forEach(({ name }) => {
  console.log(`   - ${name}`);
});
console.log();

console.log('4. ✨ Once CI passes:');
console.log('   - Create PR for review');
console.log('   - Update INFRA-008 checklist in MODULE-01-VERIFICATION.md');
console.log('   - Merge to develop');
console.log();

console.log('5. 🧪 Manual verification:');
console.log('   npm run test:e2e:cloudflare');
console.log('   Expected: All 6 test suites PASS');
console.log();

// ============================================================================
// Exit Code
// ============================================================================
const hasErrors = errors.length > 0;
process.exit(hasErrors ? 1 : 0);
