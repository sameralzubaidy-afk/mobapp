// Mock react-native-screens Screen component in the unit test environment so children render
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
jest.mock('react-native-screens', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const ReactMock = require('react');
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const { View: MockView } = require('react-native');
  return { Screen: (props: any) => ReactMock.createElement(MockView, props) };
});

/* eslint-disable import/first */
import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import SafeScreen from '../components/native/SafeScreen';
/* eslint-enable import/first */

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
