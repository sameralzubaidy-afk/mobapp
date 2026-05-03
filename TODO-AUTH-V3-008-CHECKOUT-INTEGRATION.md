# TODO: CheckoutScreen Phone Verification Integration (MODULE-06 V2)

## Context
AUTH-V3-008 requires phone verification gating for BOTH:
1. ✅ ItemCreateScreen (completed)
2. ⏸️ CheckoutScreen (MODULE-06 V2 not yet implemented)

## Implementation Required
When MODULE-06 V2 CheckoutScreen is implemented, add the same phone verification gate:

### 1. Imports
```typescript
import PhoneVerificationModal from '../components/auth/PhoneVerificationModal';
import { isPhoneRequired } from '../services/phoneService';
```

### 2. State
```typescript
const [showPhoneVerificationModal, setShowPhoneVerificationModal] = useState(false);
const [phoneVerificationPending, setPhoneVerificationPending] = useState(false);
```

### 3. Gate Logic (in checkout initiation function)
```typescript
const handleInitiateCheckout = async () => {
  // AUTH-V3-008: Phone verification gate - check BEFORE checkout
  if (!phoneVerificationPending) {
    try {
      const phoneRequired = await isPhoneRequired(userId);
      if (phoneRequired) {
        setPhoneVerificationPending(true);
        setShowPhoneVerificationModal(true);
        return; // Block checkout
      }
    } catch (err) {
      console.error('[CheckoutScreen] Phone check error:', err);
      // Graceful fallback: allow checkout if check fails
    }
  }

  // Proceed with checkout...
};
```

### 4. Modal JSX
```tsx
<PhoneVerificationModal
  visible={showPhoneVerificationModal}
  onClose={() => {
    setShowPhoneVerificationModal(false);
    setPhoneVerificationPending(false);
  }}
  onSuccess={() => {
    setShowPhoneVerificationModal(false);
    setPhoneVerificationPending(false);
    // Retry checkout after successful verification
    void handleInitiateCheckout();
  }}
  required={true}
  testID="checkout-phone-verification"
/>
```

## Verification Checklist
- [ ] Phone verification modal shown before first checkout
- [ ] Modal is non-dismissible (required=true)
- [ ] On success, checkout proceeds automatically
- [ ] Add testID for Maestro tests
- [ ] Update flow-registry.md with checkout flow

## Files to Modify
- `p2p-kids-marketplace/src/screens/checkout/CheckoutScreen.tsx` (when created)
- `docs/flow-registry.md` (add FLOW-08 checkout verification)
- `.maestro/checkout-phone-verification.yaml` (when CheckoutScreen exists)

---

**Note:** This file should be deleted after MODULE-06 V2 implementation is complete.
