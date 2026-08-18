// ⚠️ DEPRECATED (2026-08-18) — tests the stale `test-data` fixture only.
// See DEPRECATED.md in this folder. The canonical dev-autofill credential
// source is `@/utils/testUsers` (password `TestPass123`); this fixture's
// `Password123!` is NOT what the signup autofill uses.
import {
  getAllTestUsers,
  getRandomTestUser,
  getTestUserById,
  getTestUserByIndex,
  listTestUserIds,
} from './index';

describe('dev test-users seed', () => {
  test('exports five users', () => {
    const all = getAllTestUsers();
    expect(all.length).toBe(5);
  });

  test('random user returns a user with email and id', () => {
    const u = getRandomTestUser();
    expect(u).toHaveProperty('email');
    expect(u).toHaveProperty('id');
    expect(typeof u.email).toBe('string');
  });

  test('lookup by id and index works', () => {
    const ids = listTestUserIds();
    const firstId = ids[0];
    const byId = getTestUserById(firstId!);
    const byIndex = getTestUserByIndex(0);
    expect(byId?.id).toBe(firstId);
    expect(byIndex?.id).toBe(firstId);
  });
});
