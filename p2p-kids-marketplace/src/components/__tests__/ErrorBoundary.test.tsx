// File: p2p-kids-marketplace/src/components/__tests__/ErrorBoundary.test.tsx
// PROD-P003: ErrorBoundary unit tests.

import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import ErrorBoundary from '../ErrorBoundary';

// Mock the reporter so we don't depend on Sentry behavior here.
jest.mock('../../services/errorReporter', () => ({
  captureException: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { captureException } = require('../../services/errorReporter');

function Boom({ shouldThrow }: { shouldThrow: boolean }): JSX.Element {
  if (shouldThrow) throw new Error('test-boom');
  return <Text testID="ok">all good</Text>;
}

describe('ErrorBoundary', () => {
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // React logs errors caught by boundaries — silence to keep test output clean.
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('renders children when there is no error', () => {
    const { getByTestId } = render(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(getByTestId('ok')).toBeTruthy();
  });

  it('shows fallback UI when a child throws', () => {
    const { getByTestId } = render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>
    );
    expect(getByTestId('error-boundary-fallback')).toBeTruthy();
    expect(getByTestId('error-boundary-title')).toBeTruthy();
    expect(getByTestId('error-boundary-retry')).toBeTruthy();
  });

  it('reports the error via errorReporter', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>
    );
    expect(captureException).toHaveBeenCalledTimes(1);
    const [err, ctx] = (captureException as jest.Mock).mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('test-boom');
    expect(ctx).toEqual(
      expect.objectContaining({ tags: { source: 'ErrorBoundary' } })
    );
  });

  it('calls onError hook when provided', () => {
    const onError = jest.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Boom shouldThrow />
      </ErrorBoundary>
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it('resets to children when Try Again is pressed and child no longer throws', () => {
    // Use a controlled child that we can flip via rerender.
    function Controlled({ throwIt }: { throwIt: boolean }): JSX.Element {
      return <Boom shouldThrow={throwIt} />;
    }

    const { getByTestId, queryByTestId, rerender } = render(
      <ErrorBoundary>
        <Controlled throwIt />
      </ErrorBoundary>
    );

    expect(getByTestId('error-boundary-fallback')).toBeTruthy();

    // Flip the child to non-throwing BEFORE pressing retry.
    rerender(
      <ErrorBoundary>
        <Controlled throwIt={false} />
      </ErrorBoundary>
    );

    fireEvent.press(getByTestId('error-boundary-retry'));

    expect(queryByTestId('error-boundary-fallback')).toBeNull();
    expect(getByTestId('ok')).toBeTruthy();
  });

  it('renders custom fallback when provided', () => {
    const { getByTestId, queryByTestId } = render(
      <ErrorBoundary
        fallback={({ error, reset }) => (
          <Text testID="custom-fallback" onPress={reset}>
            custom: {error.message}
          </Text>
        )}
      >
        <Boom shouldThrow />
      </ErrorBoundary>
    );
    expect(getByTestId('custom-fallback')).toBeTruthy();
    expect(queryByTestId('error-boundary-fallback')).toBeNull();
  });
});
