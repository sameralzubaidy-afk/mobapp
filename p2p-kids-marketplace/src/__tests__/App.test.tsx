import React from 'react';
import { render } from '@testing-library/react-native';
import HomeFeedScreen from '../screens/home/HomeFeedScreen';
import { NavigationContainer } from '@react-navigation/native';

describe('App (smoke)', () => {
  it('renders the app title and setup text', () => {
    const { getByText } = render(
      <NavigationContainer>
        <HomeFeedScreen />
      </NavigationContainer>
    );
    expect(getByText(/Home Feed/i)).toBeTruthy();
  });
});
