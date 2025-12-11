import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import DebugScreen from '../DebugScreen'

jest.mock('../../../utils/sentry', () => ({
  captureException: jest.fn(),
}))

import Sentry from '../../../utils/sentry'

jest.mock('@/services/analytics', () => ({
  trackEvent: jest.fn(),
}));
import { trackEvent } from '@/services/analytics'

describe('DebugScreen', () => {
  it('calls Sentry.captureException when pressing Throw & Capture', () => {
    const { getByText } = render(<DebugScreen />)
    const button = getByText('Throw & Capture')
    fireEvent.press(button)
    expect(Sentry.captureException).toHaveBeenCalled()
  })

  it('sends amplitude event when pressing Send Amplitude Test Event', () => {
    (global as any).alert = jest.fn();
    const { getByText } = render(<DebugScreen />)
    const btn = getByText('Send Amplitude Test Event')
    fireEvent.press(btn)
    expect(trackEvent).toHaveBeenCalledWith('dev_analytics_test')
  })
})
