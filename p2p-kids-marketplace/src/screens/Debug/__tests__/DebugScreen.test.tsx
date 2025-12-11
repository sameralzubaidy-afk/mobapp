import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import DebugScreen from '../DebugScreen'

jest.mock('../../../utils/sentry', () => ({
  captureException: jest.fn(),
}))

import Sentry from '../../../utils/sentry'

describe('DebugScreen', () => {
  it('calls Sentry.captureException when pressing Throw & Capture', () => {
    const { getByText } = render(<DebugScreen />)
    const button = getByText('Throw & Capture')
    fireEvent.press(button)
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})
