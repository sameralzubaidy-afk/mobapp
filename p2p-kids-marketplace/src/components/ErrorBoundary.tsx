import React from 'react'
import { View, Text, Button } from 'react-native'
import Sentry from '../utils/sentry'

type State = { hasError: boolean }

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  constructor(props: {}) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    try {
      Sentry?.captureException?.(error)
    } catch (err) {
      // ignore
    }
    // optionally send extra context
    // eslint-disable-next-line no-console
    console.warn('ErrorBoundary caught an error', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Something went wrong.</Text>
          <Button title="Reload app" onPress={() => { /* TODO: trigger reload */ }} />
        </View>
      )
    }
    return this.props.children
  }
}
