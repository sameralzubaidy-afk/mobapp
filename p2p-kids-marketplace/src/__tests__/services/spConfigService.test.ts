/**
 * Unit tests for mobile calculateCategorySP
 * FILE: p2p-kids-marketplace/src/__tests__/services/spConfigService.test.ts
 * ADMIN-V3-009: Verifies mobile-side SP math matches server-side (MODULE-12)
 *
 * The mobile service fetches from DB then applies pure math.
 * These tests ensure parity with admin SP calculations.
 */

import { calculateCategorySP } from '../../services/categoryService';
import { supabase } from '../../config/supabase';

// Mock supabase
jest.mock('../../config/supabase');

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('calculateCategorySP — mobile (matches server contract)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockCategoryResponse = (mult: number, cap: number) => {
    (mockSupabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              sp_earning_multiplier: mult,
              sp_spending_cap_percent: cap,
            },
            error: null,
          }),
        }),
      }),
    });
  };

  // -------------------------------------------------------------------------
  // Math parity with server (spConfigCategoryService)
  // -------------------------------------------------------------------------

  it('earn_sp = Math.round(price * multiplier)', async () => {
    mockCategoryResponse(1.10, 70);
    const result = await calculateCategorySP('cat-1', 33);
    expect(result?.earn_sp).toBe(Math.round(33 * 1.10));
  });

  it('max_spend_sp = Math.floor(price * cap / 100)', async () => {
    mockCategoryResponse(1.10, 70);
    const result = await calculateCategorySP('cat-1', 33);
    expect(result?.max_spend_sp).toBe(Math.floor((33 * 70) / 100));
  });

  it('$50 at default 1.10 / 70% matches server preview exactly', async () => {
    mockCategoryResponse(1.10, 70);
    const result = await calculateCategorySP('cat-1', 50);
    expect(result?.earn_sp).toBe(55);
    expect(result?.max_spend_sp).toBe(35);
    expect(result?.spend_percent).toBe(70);
  });

  it('handles minimum multiplier boundary (1.05)', async () => {
    mockCategoryResponse(1.05, 50);
    const result = await calculateCategorySP('cat-1', 100);
    expect(result?.earn_sp).toBe(105);
    expect(result?.max_spend_sp).toBe(50);
  });

  it('handles maximum multiplier boundary (1.40)', async () => {
    mockCategoryResponse(1.40, 80);
    const result = await calculateCategorySP('cat-1', 100);
    expect(result?.earn_sp).toBe(140);
    expect(result?.max_spend_sp).toBe(80);
  });

  it('handles price = 0 gracefully', async () => {
    mockCategoryResponse(1.10, 70);
    const result = await calculateCategorySP('cat-1', 0);
    expect(result?.earn_sp).toBe(0);
    expect(result?.max_spend_sp).toBe(0);
  });

  it('earn_sp rounds UP correctly when decimal >= 0.5', async () => {
    // price=10, mult=1.15 → 11.5 → round=12
    mockCategoryResponse(1.15, 70);
    const result = await calculateCategorySP('cat-1', 10);
    expect(result?.earn_sp).toBe(12);
  });

  it('earn_sp rounds DOWN correctly when decimal < 0.5', async () => {
    // price=10, mult=1.12 → 11.2 → round=11
    mockCategoryResponse(1.12, 70);
    const result = await calculateCategorySP('cat-1', 10);
    expect(result?.earn_sp).toBe(11);
  });

  it('max_spend_sp floors correctly (never rounds up)', async () => {
    // price=7, cap=70 → 4.9 → floor=4
    mockCategoryResponse(1.10, 70);
    const result = await calculateCategorySP('cat-1', 7);
    expect(result?.max_spend_sp).toBe(4);
  });

  it('returns null when category not found', async () => {
    (mockSupabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        }),
      }),
    });

    const result = await calculateCategorySP('nonexistent', 50);
    expect(result).toBeNull();
  });
});
