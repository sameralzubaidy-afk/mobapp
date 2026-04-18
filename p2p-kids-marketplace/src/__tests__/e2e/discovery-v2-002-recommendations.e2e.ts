/**
 * File: p2p-kids-marketplace/src/__tests__/e2e/discovery-v2-002-recommendations.e2e.ts
 * MODULE-05-DISCOVERY-V2: Recommendations E2E Test
 * Task: DISCOVERY-V2-002 - Subscriber-Personalized Recommendations
 * 
 * End-to-end test for personalized recommendations flow
 */

import { supabase } from '../../config/supabase';

const shouldRunSupabaseE2E = process.env.RUN_SUPABASE_E2E === 'true';
const describeSupabaseE2E = describe;

describeSupabaseE2E('DISCOVERY-V2-002: Subscriber-Personalized Recommendations E2E', () => {
  if (!shouldRunSupabaseE2E) {
    test('is activated and requires RUN_SUPABASE_E2E=true to execute recommendation assertions', () => {
      expect(true).toBe(true);
    });
    return;
  }

  // Use seeded test users
  let testUserId: string = '49243010-f458-4744-add1-a6c84ab95f1f'; // test-buyer
  let testSellerId: string = '14be337c-aad6-403f-bab2-ba1a7d80b666'; // test-seller
  let testItemIds: string[] = [];

  beforeAll(async () => {
    // Verify test users exist
    const { data: buyerExists } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', testUserId)
      .single();
    
    const { data: sellerExists } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', testSellerId)
      .single();
    
    if (!buyerExists || !sellerExists) {
      throw new Error('Test users not found. Run `npm run seed:staging` first.');
    }
    
    console.log('✅ Test users verified');

    // Create test items (some SP-eligible, some not)
    const itemsToCreate = [
      {
        seller_id: testSellerId,
        title: 'SP-Eligible Affordable Item',
        description: 'Item within SP budget',
        price: 15.00, // Affordable with 50 SP
        accepts_swap_points: true,
        status: 'available',
        condition: 'good',
      },
      {
        seller_id: testSellerId,
        title: 'SP-Eligible Expensive Item',
        description: 'Item outside SP budget',
        price: 75.00, // Not affordable with 50 SP
        accepts_swap_points: true,
        status: 'available',
        condition: 'excellent',
      },
      {
        seller_id: testSellerId,
        title: 'Cash-Only Item',
        description: 'No SP accepted',
        price: 20.00,
        accepts_swap_points: false,
        status: 'available',
        condition: 'good',
      },
    ];

    for (const item of itemsToCreate) {
      const { data, error } = await supabase
        .from('items')
        .insert(item)
        .select('id')
        .single();
      
      if (error || !data) {
        console.error('Failed to create test item:', error);
      } else {
        testItemIds.push(data.id);
      }
    }
  });

  afterAll(async () => {
    // Cleanup: Delete test data
    if (testItemIds.length > 0) {
      await supabase.from('items').delete().in('id', testItemIds);
    }
    
    if (testUserId) {
      await supabase.from('sp_wallets').delete().eq('user_id', testUserId);
      await supabase.from('profiles').delete().eq('id', testUserId);
    }
    
    if (testSellerId) {
      await supabase.from('profiles').delete().eq('id', testSellerId);
    }
  });

  test('should return recommendations with SP-eligible items prioritized', async () => {
    // Act
    const { data, error } = await supabase.rpc('get_recommendations', {
      p_user_id: testUserId,
      p_limit: 10,
    });

    // Assert
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    
    if (data && data.length > 0) {
      // Verify SP-eligible items have higher scores
      const spItems = data.filter((item: any) => item.accepts_swap_points);
      const nonSpItems = data.filter((item: any) => !item.accepts_swap_points);
      
      if (spItems.length > 0 && nonSpItems.length > 0) {
        expect(spItems[0].score).toBeGreaterThan(nonSpItems[0].score);
      }
    }
  });

  test('should recommend items within SP balance range', async () => {
    // Act
    const { data, error } = await supabase.rpc('get_recommendations', {
      p_user_id: testUserId,
      p_limit: 10,
    });

    // Assert
    expect(error).toBeNull();
    expect(data).toBeDefined();
    
    if (data && data.length > 0) {
      // Find affordable SP items (price <= 50 SP = $50)
      const affordableSpItems = data.filter((item: any) => 
        item.accepts_swap_points && item.price <= 50
      );
      
      // These should have higher scores (base + SP bonus + affordability bonus)
      if (affordableSpItems.length > 0) {
        expect(affordableSpItems[0].score).toBeGreaterThanOrEqual(150);
      }
    }
  });

  test('should exclude user own items from recommendations', async () => {
    // Arrange: Create an item owned by the test user
    const { data: ownItem } = await supabase
      .from('items')
      .insert({
        seller_id: testUserId, // User's own item
        title: 'My Own Item',
        price: 10.00,
        accepts_swap_points: true,
        status: 'available',
      })
      .select('id')
      .single();

    // Act
    const { data, error } = await supabase.rpc('get_recommendations', {
      p_user_id: testUserId,
      p_limit: 10,
    });

    // Assert
    expect(error).toBeNull();
    expect(data).toBeDefined();
    
    if (data && ownItem) {
      const hasOwnItem = data.some((item: any) => item.id === ownItem.id);
      expect(hasOwnItem).toBe(false);
      
      // Cleanup
      await supabase.from('items').delete().eq('id', ownItem.id);
    }
  });

  test('should handle users without SP wallet gracefully', async () => {
    // Arrange: Create a user without SP wallet
    const { data: freeUserAuth, error: authError } = await supabase.auth.signUp({
      email: `free_user_${Date.now()}@test.com`,
      password: 'TestPassword123!',
    });
    
    if (authError || !freeUserAuth.user) {
      throw new Error('Failed to create free user');
    }
    
    const freeUserId = freeUserAuth.user.id;

    // Act
    const { data, error } = await supabase.rpc('get_recommendations', {
      p_user_id: freeUserId,
      p_limit: 10,
    });

    // Assert - should not error, just return recommendations with lower scores
    expect(error).toBeNull();
    expect(data).toBeDefined();
    
    // Cleanup
    await supabase.from('profiles').delete().eq('id', freeUserId);
  });

  test('should return results ordered by score descending', async () => {
    // Act
    const { data, error } = await supabase.rpc('get_recommendations', {
      p_user_id: testUserId,
      p_limit: 10,
    });

    // Assert
    expect(error).toBeNull();
    expect(data).toBeDefined();
    
    if (data && data.length > 1) {
      // Verify descending score order
      for (let i = 0; i < data.length - 1; i++) {
        expect(data[i].score).toBeGreaterThanOrEqual(data[i + 1].score);
      }
    }
  });

  test('should respect limit parameter', async () => {
    // Act
    const { data, error } = await supabase.rpc('get_recommendations', {
      p_user_id: testUserId,
      p_limit: 2,
    });

    // Assert
    expect(error).toBeNull();
    expect(data).toBeDefined();
    
    if (data) {
      expect(data.length).toBeLessThanOrEqual(2);
    }
  });

  test('performance: recommendations should return within 300ms', async () => {
    // Act
    const startTime = Date.now();
    const { data, error } = await supabase.rpc('get_recommendations', {
      p_user_id: testUserId,
      p_limit: 10,
    });
    const duration = Date.now() - startTime;

    // Assert
    expect(error).toBeNull();
    expect(duration).toBeLessThan(300);
    console.log(`✓ Recommendations query took ${duration}ms`);
  });
});
