// filepath: p2p-kids-marketplace/src/services/__tests__/badges-rpc-direct.test.ts
// Direct RPC test - run with: npm test badges-rpc-direct.test.ts

import { supabase } from '../../config/supabase';

describe('Direct RPC Test - get_badge_leaderboard', () => {
  test('Call RPC directly and log all details', async () => {
    console.log('\n=== DIRECT RPC TEST ===\n');

    // Test 1: Simple RPC call
    console.log('TEST 1: Calling get_badge_leaderboard(50)');
    const { data: data1, error: error1 } = await supabase.rpc('get_badge_leaderboard', {
      p_limit: 50,
    });

    console.log('Response:', {
      data: data1,
      error: error1,
      dataType: typeof data1,
      isArray: Array.isArray(data1),
      dataLength: Array.isArray(data1) ? data1.length : 'not-array',
    });

    // Test 2: Try without named parameter
    console.log('\nTEST 2: Calling with default limit');
    const { data: data2, error: error2 } = await supabase.rpc('get_badge_leaderboard');

    console.log('Response:', {
      data: data2,
      error: error2,
      dataLength: Array.isArray(data2) ? data2.length : 'not-array',
    });

    // Test 3: Direct query to see if data exists
    console.log('\nTEST 3: Direct query of user_badges table');
    const { data: badges, error: badgesError } = await supabase
      .from('user_badges')
      .select('*, badge:badges(name)', { count: 'exact' });

    console.log('User badges found:', {
      count: badges?.length,
      error: badgesError,
      sample: badges?.[0],
    });

    // Test 4: Check profiles table
    console.log('\nTEST 4: Direct query of profiles table');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, email', { count: 'exact' });

    console.log('Profiles found:', {
      count: profiles?.length,
      error: profilesError,
      sample: profiles?.[0],
    });

    console.log('\n=== END TEST ===\n');

    // Always pass - this is just for debugging
    expect(true).toBe(true);
  });
});
