import React from 'react'
import { View, Text, Button, StyleSheet } from 'react-native'
import * as DevSettings from 'expo-dev-client'

type State = { hasError: boolean; error?: Error }

export default class ErrorBoundaryDev extends React.Component<{}, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.warn('ErrorBoundaryDev caught:', error)
  }

  handleReload = () => {
    // Use Expo dev client reload when available, otherwise fall back to reloading the JS
    try {
      // expo-dev-client provides a reload API, but fallback to DevSettings
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (DevSettings && typeof DevSettings.reload === 'function') {
        // @ts-ignore
        DevSettings.reload()
        return
      }
    } catch (e) {
      // ignore
    }
    // Fallback: trigger a normal reload
    // eslint-disable-next-line global-require
    const { DevSettings: RNDevSettings } = require('react-native')
    // @ts-ignore
    RNDevSettings?.reload?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Dev Error Caught</Text>
          <Text style={styles.message}>{this.state.error?.message}</Text>
          <Button title="Reload app" onPress={this.handleReload} />
        </View>
      )
    }

    return this.props.children as any
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  message: { marginBottom: 12, textAlign: 'center' },
})
