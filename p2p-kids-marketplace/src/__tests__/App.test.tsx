import React from 'react';
import { render } from '@testing-library/react-native';
import HomeFeedScreen from '../screens/home/HomeFeedScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NativeBaseProvider } from 'native-base';

describe('App (smoke)', () => {
  it('renders the app without error', () => {
    expect(() => render(
      <SafeAreaProvider>
        <NativeBaseProvider>
          <HomeFeedScreen />
        </NativeBaseProvider>
      </SafeAreaProvider>
    )).not.toThrow();
  });
});
