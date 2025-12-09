import React from 'react';
import { render } from '@testing-library/react-native';
import HomeFeedScreen from '../screens/home/HomeFeedScreen';

describe('App (smoke)', () => {
  it('renders the app title and setup text', () => {
    const { getByText } = render(<HomeFeedScreen />);
    expect(getByText(/Home Feed/i)).toBeTruthy();
  });
});
