// ⚠️ DEPRECATED (2026-08-18) — see DEPRECATED.md in this folder.
//
// This module (+ `test-users.json`) is a STALE duplicate test-credential
// fixture. It is NOT used by any app code — the signup screen's dev-autofill
// reads `@/utils/testUsers` (password `TestPass123`). The stale fixture's
// different password (`Password123!`) caused a failed QA login (Phase 23
// credential-source-of-truth trap).
//
// CANONICAL dev-autofill source of truth: `@/utils/testUsers` (TEST_USERS).
// Kept only so any external tooling that imports `@/test-data` doesn't break;
// do NOT extend it and do NOT consume it in new code.
import users from './test-users.json';

export type TestUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  phone?: string;
  dob?: string; // YYYY-MM-DD
  password?: string;
  nodeId?: string;
};

const testUsers: TestUser[] = users as unknown as TestUser[];

export function getAllTestUsers(): TestUser[] {
  return testUsers;
}

export function getTestUserById(id: string): TestUser | undefined {
  return testUsers.find((u) => u.id === id);
}

export function getTestUserByIndex(index: number): TestUser | undefined {
  return testUsers[index];
}

export function getRandomTestUser(): TestUser {
  const idx = Math.floor(Math.random() * testUsers.length);
  return testUsers[idx];
}

export function listTestUserIds(): string[] {
  return testUsers.map((u) => u.id);
}

// NOTE: This module is intended for dev & test usage only. Guard usage in app code with `__DEV__`.
