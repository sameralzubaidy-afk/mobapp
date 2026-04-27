/**
 * Unit tests for bulkApplyToAll utility (LISTING-V3-006 V3.1).
 */
import { applyFieldToAll, suggestApplyValue } from '../bulkApplyToAll';
import type { BulkEditableItem } from '../../components/bulk/BulkItemCard';

function makeItem(overrides: Partial<BulkEditableItem> = {}): BulkEditableItem {
  return {
    groupId: overrides.groupId || `g-${Math.random()}`,
    title: '',
    description: '',
    price: '',
    condition: null,
    brand: '',
    color: [],
    age_group: null,
    gender: null,
    includeInPublish: true,
    missingRequired: [],
    ...overrides,
  };
}

describe('applyFieldToAll', () => {
  it('fills only blank values when overwrite=false', () => {
    const items = [
      makeItem({ groupId: 'a', brand: 'Lego' }),
      makeItem({ groupId: 'b', brand: '' }),
      makeItem({ groupId: 'c', brand: '   ' }),
    ];
    const result = applyFieldToAll(items, 'brand', 'Mattel');
    expect(result[0].brand).toBe('Lego');
    expect(result[1].brand).toBe('Mattel');
    expect(result[2].brand).toBe('Mattel');
  });

  it('overwrites every value when overwrite=true', () => {
    const items = [
      makeItem({ groupId: 'a', brand: 'Lego' }),
      makeItem({ groupId: 'b', brand: 'Disney' }),
    ];
    const result = applyFieldToAll(items, 'brand', 'Mattel', { overwrite: true });
    expect(result.every((i) => i.brand === 'Mattel')).toBe(true);
  });

  it('skips items not included for publish when includedOnly=true (default)', () => {
    const items = [
      makeItem({ groupId: 'a', includeInPublish: false, brand: '' }),
      makeItem({ groupId: 'b', includeInPublish: true, brand: '' }),
    ];
    const result = applyFieldToAll(items, 'brand', 'Mattel');
    expect(result[0].brand).toBe('');
    expect(result[1].brand).toBe('Mattel');
  });

  it('applies condition values across items', () => {
    const items = [makeItem({ groupId: 'a' }), makeItem({ groupId: 'b' })];
    const result = applyFieldToAll(items, 'condition', 'good');
    expect(result.every((i) => i.condition === 'good')).toBe(true);
  });
});

describe('suggestApplyValue', () => {
  it('returns null when every value is blank', () => {
    const items = [makeItem(), makeItem()];
    expect(suggestApplyValue(items, 'brand')).toBeNull();
  });

  it('returns the dominant non-blank value', () => {
    const items = [
      makeItem({ brand: 'Lego' }),
      makeItem({ brand: 'Lego' }),
      makeItem({ brand: 'Mattel' }),
    ];
    expect(suggestApplyValue(items, 'brand')).toBe('Lego');
  });

  it('handles condition enums', () => {
    const items = [
      makeItem({ condition: 'good' }),
      makeItem({ condition: 'good' }),
      makeItem({ condition: 'fair' }),
    ];
    expect(suggestApplyValue(items, 'condition')).toBe('good');
  });
});
