// File: p2p-kids-marketplace/src/utils/notificationItemGlyph.ts
/**
 * FIX-Task-13 item 5c (2026-09-10)
 *
 * Notification Center rows for different items can look near-identical — e.g.
 * several "Trade Cancelled" rows for different listings — which makes them hard
 * to scan. Notifications carry no image, so we derive a STABLE emoji from the
 * item title that the producers already store in `user_notifications.data`
 * (`item_title` for trade_* rows via migration 145, `listing_title` for the
 * offer-expiry reminders).
 *
 * Deliberately no network round-trip: the glyph is a pure function of the title,
 * so it renders identically on every mount and never blocks the list (an
 * approved owner decision for this fix — real listing thumbnails were the
 * alternative).
 */

/** Notification `data` keys that carry the item/listing title, in priority order. */
export const ITEM_TITLE_KEYS = ['item_title', 'listing_title'] as const;

/**
 * Keyword → emoji. First match wins, so the more specific patterns come first.
 * Patterns are state-free (no `/g`) so repeated `.test()` calls are safe.
 */
const KEYWORD_GLYPHS: readonly (readonly [RegExp, string])[] = [
  [/\b(bike|bicycle|scooter|tricycle)\b/i, '🚲'],
  [/\b(car|truck|vehicle|ride[- ]?on|wagon)\b/i, '🚗'],
  [/\b(lego|blocks?|plush|teddy|doll|action figure)\b/i, '🧸'],
  [/\b(puzzle|board game)\b/i, '🧩'],
  [/\b(book|books|novel|comic|story)\b/i, '📚'],
  [/\b(shirt|jacket|dress|pants|jeans|hoodie|clothes|clothing|outfit|onesie)\b/i, '👕'],
  [/\b(shoe|shoes|sneaker|sneakers|boot|boots|sandal|sandals)\b/i, '👟'],
  [/\b(coat|hat|scarf|gloves|beanie|mittens)\b/i, '🧢'],
  [/\b(phone|tablet|ipad|iphone|laptop|computer)\b/i, '📱'],
  [/\b(game|games|gaming|xbox|playstation|nintendo|switch)\b/i, '🎮'],
  [/\b(stroller|buggy|pram|carrier|car seat|high chair)\b/i, '🍼'],
  [/\b(art|paint|craft|crayon|marker|drawing|easel)\b/i, '🎨'],
  [/\b(ball|soccer|football|basketball|sport|helmet|skate)\b/i, '⚽'],
  [/\b(chair|table|desk|sofa|couch|shelf|furniture|crib|bed|mattress)\b/i, '🪑'],
  [/\b(kitchen|plate|cup|bottle|utensil|pot|pan|dish)\b/i, '🍽️'],
  [/\b(pool|swim|swimsuit|water|bath)\b/i, '🏊'],
];

/** Deterministic fallback pool for titles that match no keyword. */
const FALLBACK_GLYPHS = ['📦', '🎈', '🧩', '🎨', '📚', '🧸', '🪀', '⚽', '🚲', '🎁'] as const;

/** Small stable string hash (deterministic across runs/platforms). */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 1000003;
  }
  return hash;
}

/**
 * The item/listing title carried by a notification's `data` payload, or null
 * when the notification is not about a specific item (e.g. account events).
 */
export function getNotificationItemTitle(data?: Record<string, unknown> | null): string | null {
  if (!data) return null;
  for (const key of ITEM_TITLE_KEYS) {
    const value = data[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

/**
 * A stable emoji for the notification's item, or null when there is no item to
 * show (the row then renders exactly as before).
 */
export function getNotificationItemGlyph(data?: Record<string, unknown> | null): string | null {
  const title = getNotificationItemTitle(data);
  if (!title) return null;

  for (const [pattern, glyph] of KEYWORD_GLYPHS) {
    if (pattern.test(title)) return glyph;
  }

  return FALLBACK_GLYPHS[hashString(title.toLowerCase()) % FALLBACK_GLYPHS.length];
}
