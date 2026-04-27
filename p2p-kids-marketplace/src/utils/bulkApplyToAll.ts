/**
 * File: p2p-kids-marketplace/src/utils/bulkApplyToAll.ts
 * MODULE-04 V3.1 UX overhaul (Decision 5) — "Apply to all" shortcuts
 *
 * Pure helper: given a current list of bulk items, propagate a shared field
 * value to every included item that does not already have it set.
 * Title / price / category are intentionally NOT supported because those are
 * item-specific by definition — only the cross-item attributes are exposed.
 */

import { BulkEditableItem } from '../components/bulk/BulkItemCard';

export type ApplyToAllField = 'brand' | 'condition' | 'age_group' | 'gender';

export interface ApplyToAllOptions {
  /**
   * If `true`, overwrite values that are already set on items.
   * Defaults to `false` so the action is non-destructive (only fills blanks).
   */
  overwrite?: boolean;
  /**
   * If `true`, only apply to items where `includeInPublish === true`.
   * Defaults to `true`.
   */
  includedOnly?: boolean;
}

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Apply `value` for `field` to all matching items.
 * Returns a new items array. Original array is not mutated.
 */
export function applyFieldToAll(
  items: BulkEditableItem[],
  field: ApplyToAllField,
  value: BulkEditableItem[ApplyToAllField],
  options: ApplyToAllOptions = {},
): BulkEditableItem[] {
  const { overwrite = false, includedOnly = true } = options;
  return items.map((item) => {
    if (includedOnly && !item.includeInPublish) return item;
    const current = item[field];
    if (!overwrite && !isBlank(current)) return item;
    return { ...item, [field]: value };
  });
}

/**
 * Suggest the dominant value for an apply-to-all field across items.
 * Used to power the "Apply to all" bar — we surface the most common
 * non-blank suggestion so sellers can one-tap propagate it.
 */
export function suggestApplyValue(
  items: BulkEditableItem[],
  field: ApplyToAllField,
): BulkEditableItem[ApplyToAllField] | null {
  const counts = new Map<string, { count: number; raw: BulkEditableItem[ApplyToAllField] }>();
  items.forEach((item) => {
    const raw = item[field];
    if (isBlank(raw)) return;
    const key = typeof raw === 'string' ? raw : JSON.stringify(raw);
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { count: 1, raw });
  });

  type Entry = { count: number; raw: BulkEditableItem[ApplyToAllField] };
  let best: Entry | null = null;
  counts.forEach((value) => {
    const current: Entry | null = best;
    if (!current || value.count > current.count) best = value;
  });
  return best ? (best as Entry).raw : null;
}
