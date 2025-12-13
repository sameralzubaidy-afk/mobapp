import { Platform } from 'react-native';

// This service calls a backend API endpoint to send SMS (server-side credentials only)
// Use the URL of the deployed Edge Function / API Gateway in EXPO_PUBLIC_SMS_API_URL

export interface SendSMSParams {
  phoneNumber: string;
  message: string;
}

const SMS_API_URL = process.env.EXPO_PUBLIC_SMS_API_URL || '';

export const sendSMS = async ({ phoneNumber, message }: SendSMSParams) => {
  if (!SMS_API_URL) {
    throw new Error('SMS API URL not configured. Set EXPO_PUBLIC_SMS_API_URL in .env.local');
  }

  try {
    const res = await fetch(`${SMS_API_URL}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phoneNumber, message, platform: Platform.OS }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SMS API Error: ${res.status} ${text}`);
    }

    const json = await res.json();
    return json;
  } catch (error) {
    console.error('sendSMS error:', error);
    throw error;
  }
};

export const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendVerificationCode = async (phoneNumber: string) => {
  const code = generateVerificationCode();
  const message = `Your verification code is: ${code}`;
  const result = await sendSMS({ phoneNumber, message });
  // NOTE: The server should store the code tied to the user/session (not the client)
  return { success: true, code, result };
};