
const fetch = require('node-fetch');
require('dotenv').config({ path: './p2p-kids-marketplace/.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

async function testEdgeFunction() {
  const url = `${supabaseUrl}/functions/v1/trade-payment`;
  console.log(`Testing Edge Function at: ${url}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        tradeId: 'invalid-id',
        paymentMethodId: 'pm_card_visa',
      }),
    });

    const status = response.status;
    const body = await response.json();

    console.log(`Status: ${status}`);
    console.log('Body:', JSON.stringify(body, null, 2));

    if (status === 200) {
      console.log('✅ Success (or handled error)');
    } else {
      console.log('❌ Error');
    }
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

testEdgeFunction();
