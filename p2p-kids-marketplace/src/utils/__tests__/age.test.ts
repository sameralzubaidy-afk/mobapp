import { isAtLeastAge } from '../age';

test('isAtLeastAge returns true for 18 years old or older', () => {
  // 20 years ago
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 20);
  const iso = d.toISOString().slice(0, 10);
  expect(isAtLeastAge(iso, 18)).toBe(true);
});

test('isAtLeastAge returns false for under 18', () => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 17);
  const iso = d.toISOString().slice(0, 10);
  expect(isAtLeastAge(iso, 18)).toBe(false);
});

test('invalid formats return false', () => {
  expect(isAtLeastAge('invalid-date', 18)).toBe(false);
});
