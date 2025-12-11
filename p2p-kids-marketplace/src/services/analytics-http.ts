// Lightweight HTTP-based analytics helper for Expo Go (dev-only)
import Constants from 'expo-constants';

const AMPLITUDE_KEY = process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY || '';
const AMPLITUDE_URL = 'https://api2.amplitude.com/2/httpapi';

export async function trackEventHttp(eventType: string, eventProperties?: Record<string, any>, userId?: string) {
  if (!AMPLITUDE_KEY) {
    // eslint-disable-next-line no-console
    console.warn('Amplitude API key not set; dropping event', eventType, eventProperties);
    return;
  }

  const payload = {
    api_key: AMPLITUDE_KEY,
    events: [
      {
        user_id: userId || 'dev_user',
        event_type: eventType,
        event_properties: eventProperties || {},
        device_id: Constants.sessionId || 'dev_session',
      },
    ],
  };

  try {
    const res = await fetch(AMPLITUDE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn('Amplitude HTTP error', res.status, await res.text());
    } else {
      // eslint-disable-next-line no-console
      console.log('Amplitude HTTP event sent', eventType, eventProperties);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Amplitude HTTP send failed', err);
  }
}

export function identifyUserHttp(userId: string, userProperties?: Record<string, any>) {
  // No-op for now. Could call amplitude identify endpoint if needed.
  // eslint-disable-next-line no-console
  console.log('identifyUserHttp', userId, userProperties);
}

export default { trackEventHttp, identifyUserHttp };
