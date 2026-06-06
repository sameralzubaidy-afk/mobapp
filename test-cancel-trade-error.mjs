#!/usr/bin/env node
/**
 * Test script to call cancel-trade Edge Function and see full error response
 * Usage: node test-cancel-trade-error.mjs <trade_id> <auth_token>
 */

const SUPABASE_URL = 'https://drntwgporzabmxdqykrp.supabase.co';
const tradeId = process.argv[2] || '231f65ea-49f0-49a7-a0f9-1e337947affa';
const authToken = process.argv[3];

if (!authToken) {
  console.error('Usage: node test-cancel-trade-error.mjs <trade_id> <auth_token>');
  console.error('Get auth token from app logs or Supabase Dashboard > Auth > Users');
  process.exit(1);
}

async function testCancelTrade() {
  console.log('🧪 Testing cancel-trade Edge Function...');
  console.log(`Trade ID: ${tradeId}`);
  console.log(`Endpoint: ${SUPABASE_URL}/functions/v1/cancel-trade\n`);

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/cancel-trade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        tradeId: tradeId,
        reason: 'Test cancellation to see full error'
      })
    });

    const responseText = await response.text();
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log(`📦 Response Headers:`, Object.fromEntries(response.headers.entries()));
    console.log(`\n📄 Response Body (${responseText.length} bytes):`);
    
    try {
      const json = JSON.parse(responseText);
      console.log(JSON.stringify(json, null, 2));
    } catch {
      console.log(responseText);
    }

    if (!response.ok) {
      console.error('\n❌ Request failed');
      process.exit(1);
    } else {
      console.log('\n✅ Request succeeded');
    }
  } catch (error) {
    console.error('\n💥 Network error:', error.message);
    process.exit(1);
  }
}

testCancelTrade();
