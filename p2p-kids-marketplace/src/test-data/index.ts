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
