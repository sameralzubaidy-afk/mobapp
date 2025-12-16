// Test users for development autofill on signup screen

export interface TestUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string; // YYYY-MM-DD
  password: string;
}

export const TEST_USERS: TestUser[] = [
  {
    id: 'test-user-1',
    firstName: 'Alice',
    lastName: 'Test',
    email: 'alice.test@example.com',
    phone: '+12025551234',
    dob: '2000-01-15',
    password: 'TestPass123',
  },
  {
    id: 'test-user-2',
    firstName: 'Bob',
    lastName: 'Demo',
    email: 'bob.demo@example.com',
    phone: '+12025555678',
    dob: '2001-06-20',
    password: 'DemoPass456',
  },
  {
    id: 'test-user-3',
    firstName: 'Charlie',
    lastName: 'Smith',
    email: 'charlie.smith@example.com',
    phone: '+12025559999',
    dob: '1999-03-10',
    password: 'SmithPass789',
  },
];

export const getTestUserById = (id: string): TestUser | undefined => {
  return TEST_USERS.find((u) => u.id === id);
};

export const getAllTestUsers = (): TestUser[] => {
  return TEST_USERS;
};

export const getRandomTestUser = (): TestUser => {
  return TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];
};
