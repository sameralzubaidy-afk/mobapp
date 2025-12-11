import React from 'react'
import { render, fireEvent, screen } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import HomeFeedScreen, { homeSendSentryTest, homeSendAmplitudeTest } from '../HomeFeedScreen'
import { NativeBaseProvider } from 'native-base'

jest.mock('../../../utils/sentry', () => ({
  captureException: jest.fn(),
}))
import Sentry from '../../../utils/sentry'

jest.mock('@/services/analytics', () => ({
  trackEvent: jest.fn(),
}))
import { trackEvent } from '@/services/analytics'

describe('HomeFeedScreen', () => {
  it('sends amplitude event when pressing NB lg button', () => {
    (global as any).alert = jest.fn();
    // call debug handler directly so we don't need to render the full tree
    homeSendAmplitudeTest()
    expect(trackEvent).toHaveBeenCalledWith('home_nb_lg_pressed')
  })

  it('calls Sentry.captureException when pressing Send Sentry Test', () => {
    (global as any).alert = jest.fn();
    // call debug handler directly so we don't need to render the full tree
    homeSendSentryTest()
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})
