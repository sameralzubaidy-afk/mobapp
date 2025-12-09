import { isDetentProp, sanitizePropValue, sanitizePropsObject } from '../propSanitizer';

describe('propSanitizer', () => {
  test('detects detent props correctly', () => {
    expect(isDetentProp('sheetAllowedDetents')).toBe(true);
    expect(isDetentProp('sheetLargestUndimmedDetent')).toBe(true);
    expect(isDetentProp('somethingElse')).toBe(false);
  });

  test('preserves detent strings', () => {
    expect(sanitizePropValue('sheetAllowedDetents', 'large')).toBe('large');
    expect(sanitizePropValue('sheetLargestUndimmedDetent', 'all')).toBe('all');
  });

  test('resolves size tokens for numeric props', () => {
    // 'large' -> 24 per themeTokens.resolveToken
    expect(sanitizePropValue('width', 'large')).toBe(24);
    expect(sanitizePropValue('height', 'md')).toBe(20);
    // numeric strings get parsed
    expect(sanitizePropValue('padding', '18')).toBe(18);
    // unknown strings remain unchanged
    expect(sanitizePropValue('flex', 'auto')).toBe('auto');
  });

  test('sanitizes objects shallowly', () => {
    const input = {
      width: 'lg',
      sheetAllowedDetents: 'all',
      padding: '16',
    };
    const result = sanitizePropsObject(input);
    expect(result.width).toBe(24);
    expect(result.sheetAllowedDetents).toBe('all');
    expect(result.padding).toBe(16);
  });
});
