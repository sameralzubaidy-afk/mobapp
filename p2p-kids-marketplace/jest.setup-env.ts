import '@testing-library/jest-native/extend-expect';

declare const jest: any;

// Silence native warnings that commonly appear in test runs
jest.useFakeTimers && jest.useFakeTimers();

// Other env setup if needed
