import { init, track, identify, setUserId, Identify } from '@amplitude/analytics-react-native';

const AMPLITUDE_API_KEY = process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY || '';

export const initAnalytics = async () => {
  if (!AMPLITUDE_API_KEY) {
    console.warn('Amplitude API key not found');
    return;
  }

  // Ensure a minimal `document` exists to avoid cookie writing errors in some
  // development environments that attempt to use cookie storage (the Amplitude
  // library can try to write cookies when running in a hybrid environment).
  if (typeof globalThis !== 'undefined' && typeof (globalThis as any).document === 'undefined') {
    (globalThis as any).document = { cookie: '' };
  }

  try {
    await init(AMPLITUDE_API_KEY, undefined, {
      trackingOptions: {
        // Avoid collecting device_id or advertising identifiers by default
        device_id: false,
        advertising_id: false,
      },
      // Use minimal buffering to ensure events appear quickly during testing
      flushIntervalMillis: 2000,
    });
    console.log('✅ Amplitude initialized');
  } catch (err) {
    console.warn('Failed to init Amplitude', err);
  }
};

export const trackEvent = (eventName: string, eventProperties?: Record<string, any>) => {
  try {
    track(eventName, eventProperties);
  } catch (err) {
    console.warn('Amplitude track error', err);
  }
};

export const identifyUser = (userId: string, userProperties?: Record<string, any>) => {
  try {
    setUserId(userId);
    if (userProperties) {
      const identifyObj = new Identify();
      Object.entries(userProperties).forEach(([k, v]) => identifyObj.set(k, v as any));
      identify(identifyObj);
    }
  } catch (err) {
    console.warn('Amplitude identify error', err);
  }
};

export const clearUser = () => {
  try {
    setUserId(undefined);
  } catch (err) {
    console.warn('Amplitude clear user error', err);
  }
};
