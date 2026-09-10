// File: p2p-kids-marketplace/src/utils/__tests__/notificationItemGlyph.test.ts
// FIX-Task-13 item 5c (2026-09-10) — Notification Center item emoji.

import {
  ITEM_TITLE_KEYS,
  getNotificationItemGlyph,
  getNotificationItemTitle,
} from '../notificationItemGlyph';

describe('getNotificationItemTitle', () => {
  it('prefers item_title, then listing_title', () => {
    expect(ITEM_TITLE_KEYS).toEqual(['item_title', 'listing_title']);
    expect(getNotificationItemTitle({ item_title: 'Blue Bike' })).toBe('Blue Bike');
    expect(getNotificationItemTitle({ listing_title: 'LEGO Bucket' })).toBe('LEGO Bucket');
    expect(
      getNotificationItemTitle({ item_title: 'Blue Bike', listing_title: 'LEGO Bucket' })
    ).toBe('Blue Bike');
  });

  it('ignores blank/missing/non-string values', () => {
    expect(getNotificationItemTitle({ item_title: '   ' })).toBeNull();
    expect(getNotificationItemTitle({ item_title: 42 })).toBeNull();
    expect(getNotificationItemTitle({})).toBeNull();
    expect(getNotificationItemTitle(null)).toBeNull();
    expect(getNotificationItemTitle(undefined)).toBeNull();
  });
});

describe('getNotificationItemGlyph', () => {
  it('maps common item keywords to an emoji', () => {
    expect(getNotificationItemGlyph({ item_title: 'Blue Bike' })).toBe('🚲');
    expect(getNotificationItemGlyph({ listing_title: 'LEGO Bucket' })).toBe('🧸');
    expect(getNotificationItemGlyph({ item_title: "Toddler's Story Book" })).toBe('📚');
    expect(getNotificationItemGlyph({ item_title: 'Winter Jacket' })).toBe('👕');
  });

  it('returns null for notifications that are not about an item', () => {
    expect(getNotificationItemGlyph({ type: 'subscription_renewed' })).toBeNull();
    expect(getNotificationItemGlyph(null)).toBeNull();
  });

  it('is deterministic for unmatched titles (stable across renders)', () => {
    const first = getNotificationItemGlyph({ item_title: 'Zzz mystery thing' });
    const second = getNotificationItemGlyph({ item_title: 'Zzz mystery thing' });
    expect(first).not.toBeNull();
    expect(first).toBe(second);
  });

  it('is case-insensitive for the matched keywords', () => {
    expect(getNotificationItemGlyph({ item_title: 'blue BIKE' })).toBe('🚲');
  });
});
