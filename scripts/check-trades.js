
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './p2p-kids-marketplace/.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTrades() {
  const { data, error } = await supabase
    .from('trades')
    .select('id, buyer_id, seller_id, status, cash_amount_cents, sp_amount, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching trades:', error);
    return;
  }

  console.log('Recent Trades:');
  console.table(data);

  if (data.length > 0) {
    const buyerId = data[0].buyer_id;
    console.log(`Checking buyer info for: ${buyerId}`);
    const { data: buyer, error: buyerError } = await supabase.auth.admin.getUserById(buyerId);
    if (buyerError) {
      console.error('Error fetching buyer from auth:', buyerError);
    } else {
      console.log('Buyer found in auth:', buyer.user.email);
    }
  }
}

checkTrades();
