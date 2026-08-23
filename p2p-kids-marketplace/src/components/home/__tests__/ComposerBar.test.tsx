/**
 * File: p2p-kids-marketplace/src/components/home/__tests__/ComposerBar.test.tsx
 *
 * Home composer bar behavior:
 *  - tap focuses (no navigation), fires composer_bar_tapped
 *  - "+" / keyboard return submits to ItemCreate with typed text pre-filled
 *  - empty submit behaves identically with empty prefilledTitle
 *  - camera icon opens New Item straight to camera with title pre-filled
 *  - fires composer_bar_submit with has_text true/false
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import ComposerBar from '../ComposerBar';
import { useNavigation } from '@react-navigation/native';
import { trackEvent } from '@/services/analytics';
import { COMPOSER_EVENTS } from '@/constants/analytics-events';

jest.mock('@react-navigation/native', () => ({ useNavigation: jest.fn() }));
jest.mock('@/services/analytics', () => ({ trackEvent: jest.fn() }));

const mockNavigate = jest.fn();

function setup() {
  (useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate });
}

describe('ComposerBar — Home Composer Redesign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setup();
  });

  it('renders the placeholder, camera icon and + button', () => {
    const { getByPlaceholderText, getByTestId } = render(<ComposerBar />);
    expect(getByPlaceholderText('What are you selling today?')).toBeTruthy();
    expect(getByTestId('composer-camera-button')).toBeTruthy();
    expect(getByTestId('composer-add-button')).toBeTruthy();
  });

  it('tapping the bar focuses the input (no navigation)', () => {
    const { getByTestId } = render(<ComposerBar />);
    fireEvent.press(getByTestId('composer-bar'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // P18 fix: composer_bar_tapped fires from the TextInput's onFocus (the bar's
  // onPress is shadowed by camera/input/"+" hit areas), so the event is asserted
  // against a real focus, not a press of the unreachable bar surface.
  it('focusing the input fires composer_bar_tapped (primary composer interaction)', () => {
    const { getByTestId } = render(<ComposerBar />);
    fireEvent(getByTestId('composer-input'), 'focus');
    expect(trackEvent).toHaveBeenCalledWith(COMPOSER_EVENTS.BAR_TAPPED);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('tapping + with text navigates to ItemCreate with the typed title pre-filled', () => {
    const { getByTestId } = render(<ComposerBar />);
    fireEvent.changeText(getByTestId('composer-input'), 'Lego Star Wars Set');
    fireEvent.press(getByTestId('composer-add-button'));
    expect(mockNavigate).toHaveBeenCalledWith('ItemCreate', {
      prefilledTitle: 'Lego Star Wars Set',
    });
    expect(trackEvent).toHaveBeenCalledWith(COMPOSER_EVENTS.SUBMITTED, { has_text: true });
  });

  it('tapping + with no text navigates to ItemCreate with an empty Title', () => {
    const { getByTestId } = render(<ComposerBar />);
    fireEvent.press(getByTestId('composer-add-button'));
    expect(mockNavigate).toHaveBeenCalledWith('ItemCreate', { prefilledTitle: '' });
    expect(trackEvent).toHaveBeenCalledWith(COMPOSER_EVENTS.SUBMITTED, { has_text: false });
  });

  it('keyboard return submits with the typed text', () => {
    const { getByTestId } = render(<ComposerBar />);
    fireEvent.changeText(getByTestId('composer-input'), 'Nike Shoes');
    fireEvent(getByTestId('composer-input'), 'submitEditing');
    expect(mockNavigate).toHaveBeenCalledWith('ItemCreate', {
      prefilledTitle: 'Nike Shoes',
    });
  });

  it('camera icon opens ItemCreate straight to the camera with title pre-filled', () => {
    const { getByTestId } = render(<ComposerBar />);
    fireEvent.changeText(getByTestId('composer-input'), 'Bicycle');
    fireEvent.press(getByTestId('composer-camera-button'));
    expect(mockNavigate).toHaveBeenCalledWith('ItemCreate', {
      prefilledTitle: 'Bicycle',
      initialPhotoSource: 'camera',
    });
  });

  it('always routes to the single-item flow (no Bulk Upload from the bar)', () => {
    const { getByTestId } = render(<ComposerBar />);
    fireEvent.press(getByTestId('composer-add-button'));
    const calls = (mockNavigate as jest.Mock).mock.calls;
    expect(calls.some((c) => c[0] === 'BulkListingCreate')).toBe(false);
  });
});
