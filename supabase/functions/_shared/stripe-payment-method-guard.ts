type PaymentMethodValidationSuccess = {
  ok: true;
  paymentMethodId: string;
};

type PaymentMethodValidationFailure = {
  ok: false;
  code: 'MISSING_PAYMENT_METHOD' | 'CARD_DATA_FORBIDDEN' | 'INVALID_PAYMENT_METHOD_ID';
  message: string;
};

export type PaymentMethodValidationResult =
  | PaymentMethodValidationSuccess
  | PaymentMethodValidationFailure;

function looksLikeRawCardData(value: string): boolean {
  if (!/^[0-9\s-]+$/.test(value)) {
    return false;
  }

  const digitCount = value.replace(/\D/g, '').length;
  return digitCount >= 12 && digitCount <= 19;
}

export function validateStripePaymentMethodId(rawValue: unknown): PaymentMethodValidationResult {
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return {
      ok: false,
      code: 'MISSING_PAYMENT_METHOD',
      message: 'Missing payment method ID. Expected Stripe PaymentMethod ID (pm_...).',
    };
  }

  const paymentMethodId = rawValue.trim();

  if (looksLikeRawCardData(paymentMethodId)) {
    return {
      ok: false,
      code: 'CARD_DATA_FORBIDDEN',
      message:
        'Raw card data is not accepted. Use Stripe SDK or Payment Sheet and send only PaymentMethod ID (pm_...).',
    };
  }

  if (!/^pm_[A-Za-z0-9]+$/.test(paymentMethodId)) {
    return {
      ok: false,
      code: 'INVALID_PAYMENT_METHOD_ID',
      message: 'Invalid payment method format. Expected Stripe PaymentMethod ID (pm_...).',
    };
  }

  return {
    ok: true,
    paymentMethodId,
  };
}

export function redactPaymentMethodForLogs(rawValue: unknown): string {
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return '[missing]';
  }

  const value = rawValue.trim();

  if (value.startsWith('pm_')) {
    const tail = value.slice(-6);
    return `pm_***${tail}`;
  }

  if (looksLikeRawCardData(value)) {
    return '[raw-card-data-blocked]';
  }

  return '[invalid-format]';
}