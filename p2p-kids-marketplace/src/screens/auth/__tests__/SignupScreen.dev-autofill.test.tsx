import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// Mock navigation hooks used by the component
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));

// Ensure dev-only UI shows up
(global as any).__DEV__ = true;

import SignupScreen from '../SignupScreen';
import { getAllTestUsers } from '@/test-data';

describe('SignupScreen dev autofill buttons', () => {
  test('pressing Fill Random populates inputs', async () => {
    const { getByTestId } = render(<SignupScreen />);

    const fillBtn = getByTestId('dev-fill-random-user');
    fireEvent.press(fillBtn);

    const user = getAllTestUsers()[0];

    await waitFor(() => {
      expect(getByTestId('name-input').props.value).toBeDefined();
      expect(getByTestId('email-input').props.value).toMatch(/@example.com$/);
    });
  });
});
