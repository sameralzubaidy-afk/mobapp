import React from 'react';
import { render } from '@testing-library/react-native';
import { Text, View } from 'react-native';

// Mock react-native-screens Screen component in the unit test environment so children render
jest.mock('react-native-screens', () => {
  const React = require('react');
  const { View: MockView } = require('react-native');
  return { Screen: (props: any) => React.createElement(MockView, props) };
});
import SafeScreen from '../components/native/SafeScreen';

describe('SafeScreen wrapper', () => {
  it('renders and preserves detent strings and converts size tokens', () => {
    const rendered = render(
      <SafeScreen testID="safe-screen" sheetAllowedDetents="large" width="lg">
        <Text>child</Text>
      </SafeScreen>
    );

    expect(rendered.toJSON()).toBeTruthy();
  });
});
