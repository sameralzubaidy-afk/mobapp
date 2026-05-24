// File: p2p-kids-marketplace/src/screens/__tests__/LoadingScreen.test.tsx
// FLOW-26 Unit Tests: LoadingScreen

import React from 'react';
import { render } from '@testing-library/react-native';
import LoadingScreen from '../LoadingScreen';

describe('LoadingScreen', () => {
  it('renders correctly with default message', () => {
    const { getByTestId } = render(<LoadingScreen />);
    
    expect(getByTestId('loading-screen')).toBeTruthy();
    expect(getByTestId('loading-indicator')).toBeTruthy();
    expect(getByTestId('loading-text')).toBeTruthy();
  });

  it('displays default loading message', () => {
    const { getByTestId } = render(<LoadingScreen />);
    const loadingText = getByTestId('loading-text');
    
    expect(loadingText.props.children).toBe('Loading…');
  });

  it('displays custom message when provided', () => {
    const customMessage = 'Fetching your items...';
    const { getByTestId } = render(<LoadingScreen message={customMessage} />);
    const loadingText = getByTestId('loading-text');
    
    expect(loadingText.props.children).toBe(customMessage);
  });

  it('has activity indicator with correct color', () => {
    const { getByTestId } = render(<LoadingScreen />);
    const indicator = getByTestId('loading-indicator');
    
    expect(indicator.props.color).toBe('#5DBB8E');
    expect(indicator.props.size).toBe('large');
  });

  it('has white background', () => {
    const { getByTestId } = render(<LoadingScreen />);
    const screen = getByTestId('loading-screen');
    
    expect(screen.props.style).toMatchObject(
      expect.objectContaining({ backgroundColor: '#FFFFFF' })
    );
  });
});
