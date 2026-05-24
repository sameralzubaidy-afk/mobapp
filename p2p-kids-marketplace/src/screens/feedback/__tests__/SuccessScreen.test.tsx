// File: p2p-kids-marketplace/src/screens/feedback/__tests__/SuccessScreen.test.tsx
// FLOW-26 Unit Tests: SuccessScreen

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SuccessScreen from '../SuccessScreen';

// Mock navigation
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);
let mockRouteParams = {};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: mockNavigate,
    canGoBack: mockCanGoBack,
  }),
  useRoute: () => ({
    params: mockRouteParams,
  }),
}));

describe('SuccessScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {};
  });

  it('renders correctly with default params', () => {
    const { getByTestId } = render(<SuccessScreen />);
    
    expect(getByTestId('success-screen')).toBeTruthy();
    expect(getByTestId('success-icon')).toBeTruthy();
    expect(getByTestId('success-title')).toBeTruthy();
    expect(getByTestId('success-cta-button')).toBeTruthy();
  });

  it('displays default title', () => {
    const { getByTestId } = render(<SuccessScreen />);
    const title = getByTestId('success-title');
    
    expect(title.props.children).toBe('Success!');
  });

  it('displays custom title from route params', () => {
    mockRouteParams = { title: 'Item Listed!' };
    
    const { getByTestId } = render(<SuccessScreen />);
    const title = getByTestId('success-title');
    
    expect(title.props.children).toBe('Item Listed!');
  });

  it('does not render subtitle when not provided', () => {
    const { queryByTestId } = render(<SuccessScreen />);
    
    expect(queryByTestId('success-subtitle')).toBeNull();
  });

  it('displays subtitle when provided in route params', () => {
    mockRouteParams = {
      title: 'Success',
      subtitle: 'Your item has been listed successfully',
    };
    
    const { getByTestId } = render(<SuccessScreen />);
    const subtitle = getByTestId('success-subtitle');
    
    expect(subtitle.props.children).toBe('Your item has been listed successfully');
  });

  it('displays default CTA label', () => {
    const { getByText } = render(<SuccessScreen />);
    
    expect(getByText('Continue')).toBeTruthy();
  });

  it('displays custom CTA label from route params', () => {
    mockRouteParams = { ctaLabel: 'View Listings' };
    
    const { getByText } = render(<SuccessScreen />);
    
    expect(getByText('View Listings')).toBeTruthy();
  });

  it('calls navigation.goBack on CTA press by default', () => {
    const { getByTestId } = render(<SuccessScreen />);
    const ctaButton = getByTestId('success-cta-button');
    
    fireEvent.press(ctaButton);
    
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('navigates to specified screen when ctaAction is navigate', () => {
    mockRouteParams = {
      ctaAction: 'navigate',
      ctaScreen: 'MyListings',
    };
    
    const { getByTestId } = render(<SuccessScreen />);
    const ctaButton = getByTestId('success-cta-button');
    
    fireEvent.press(ctaButton);
    
    expect(mockNavigate).toHaveBeenCalledWith('MyListings');
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('has correct design system colors', () => {
    const { getByTestId } = render(<SuccessScreen />);
    const ctaButton = getByTestId('success-cta-button');
    
    expect(ctaButton.props.style).toMatchObject(
      expect.objectContaining({ backgroundColor: '#5DBB8E' })
    );
  });
});
