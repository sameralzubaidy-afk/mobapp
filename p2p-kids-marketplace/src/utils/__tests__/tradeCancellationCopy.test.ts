// File: p2p-kids-marketplace/src/utils/__tests__/tradeCancellationCopy.test.ts
// DEV-TASK-113 (2026-09-05) item 1: friendly cancellation-reason copy must
// NEVER return a raw machine code for any input, must be role-appropriate, and
// must branch on refund context for the dispute-refund reason (D1, owner).

import {
  getFriendlyCancellationReason,
  isDisputeRefundCancelled,
  GENERIC_CANCELLATION_COPY,
} from '../tradeCancellationCopy';

// Every code the QA finding #1 flagged as landing on the cancelled banner.
const KNOWN_CODES = [
  'dispute_resolved_refund',
  'dispute_resolved_refund_uncaptured',
  'changed_mind',
  'found_elsewhere',
  'other',
  'requested_by_customer',
  'payment_hold_failed',
  'authorization_expired',
  'seller_declined',
  'offer_expired_competing',
  'Another offer accepted',
  'extension_denied',
  'extension_timeout',
  'extension_reauth_failed',
  'buyer_cancelled',
  'Offer expired',
  'offer_expired',
  'cant_do_pickup',
  'item_no_longer_available',
  'no_longer_need_item',
  'meetup_issue',
  'some_future_unknown_code',
  '',
  null,
  undefined,
];

const RAW_CODE_RE = /^[a-z]+(_[a-z0-9]+)*$/;

describe('getFriendlyCancellationReason', () => {
  it('never returns a raw snake_case code for any known or unknown input/role', () => {
    for (const role of ['buyer', 'seller'] as const) {
      for (const refund of [null, { refunded: true }, { refunded: false }]) {
        for (const code of KNOWN_CODES) {
          const out = getFriendlyCancellationReason(code, role, refund);
          expect(out.length).toBeGreaterThan(0);
          expect(out).not.toMatch(RAW_CODE_RE);
          expect(out).not.toContain('dispute_resolved');
          expect(out).not.toContain('Reason:');
        }
      }
    }
  });

  it('unknown codes fall back to the generic sentence (never blank, never raw)', () => {
    expect(getFriendlyCancellationReason('some_future_unknown_code', 'buyer')).toBe(
      GENERIC_CANCELLATION_COPY
    );
    expect(getFriendlyCancellationReason('some_future_unknown_code', 'seller')).toBe(
      GENERIC_CANCELLATION_COPY
    );
    expect(getFriendlyCancellationReason(null, 'buyer')).toBe(GENERIC_CANCELLATION_COPY);
    expect(getFriendlyCancellationReason('', 'seller')).toBe(GENERIC_CANCELLATION_COPY);
  });

  describe('dispute_resolved_refund (D1 — branch on refund data)', () => {
    const code = 'dispute_resolved_refund';
    it('buyer + real refund -> confirms the refund', () => {
      expect(getFriendlyCancellationReason(code, 'buyer', { refunded: true })).toBe(
        'This trade was cancelled and your payment was refunded.'
      );
    });
    it('buyer + no refund (uncaptured) -> says no payment was taken', () => {
      expect(getFriendlyCancellationReason(code, 'buyer', { refunded: false })).toBe(
        'This trade was cancelled. No payment was taken.'
      );
    });
    it('buyer + unknown refund state -> neutral, does NOT claim a refund', () => {
      expect(getFriendlyCancellationReason(code, 'buyer', null)).toBe(
        'This trade was cancelled by our support team.'
      );
    });
    it('seller -> support-team phrasing for both refund states', () => {
      expect(getFriendlyCancellationReason(code, 'seller', { refunded: true })).toBe(
        'This trade was cancelled by our support team.'
      );
      expect(getFriendlyCancellationReason(code, 'seller', { refunded: false })).toBe(
        'This trade was cancelled by our support team.'
      );
    });
  });

  it('dispute_resolved_refund_uncaptured -> no payment taken (buyer) / support (seller)', () => {
    expect(
      getFriendlyCancellationReason('dispute_resolved_refund_uncaptured', 'buyer')
    ).toBe('This trade was cancelled. No payment was taken.');
    expect(
      getFriendlyCancellationReason('dispute_resolved_refund_uncaptured', 'seller')
    ).toBe('This trade was cancelled by our support team.');
  });

  it('seller_declined is role-appropriate', () => {
    expect(getFriendlyCancellationReason('seller_declined', 'buyer')).toBe(
      'The seller declined this offer.'
    );
    expect(getFriendlyCancellationReason('seller_declined', 'seller')).toBe(
      'You declined this offer.'
    );
  });

  it('maps the remaining system codes to friendly copy for both roles', () => {
    const expectations: Array<[string, string]> = [
      ['offer_expired_competing', 'Another offer on this item was accepted.'],
      ['Another offer accepted', 'Another offer on this item was accepted.'],
      ['authorization_expired', 'This trade was cancelled because the payment authorization expired.'],
      ['payment_hold_failed', 'This trade was cancelled because the payment could not be authorized.'],
      ['extension_denied', 'The other party declined your extension request.'],
      ['extension_timeout', 'The extension request expired without a response.'],
      ['extension_reauth_failed', 'The extension request could not be completed.'],
      ['Offer expired', 'This offer expired.'],
      ['offer_expired', 'This offer expired.'],
    ];
    for (const role of ['buyer', 'seller'] as const) {
      for (const [code, expected] of expectations) {
        expect(getFriendlyCancellationReason(code, role)).toBe(expected);
      }
    }
  });

  it('buyer-selectable cancel reasons attribute to the buyer for the seller view', () => {
    for (const code of ['changed_mind', 'found_elsewhere', 'no_longer_need_item', 'meetup_issue']) {
      expect(getFriendlyCancellationReason(code, 'seller')).toBe(
        'The buyer cancelled this trade.'
      );
      expect(getFriendlyCancellationReason(code, 'buyer')).toBe('You cancelled this trade.');
    }
  });

  it('seller-selectable cancel reasons attribute to the seller for the buyer view', () => {
    for (const code of ['cant_do_pickup', 'item_no_longer_available']) {
      expect(getFriendlyCancellationReason(code, 'buyer')).toBe(
        'The seller cancelled this trade.'
      );
      expect(getFriendlyCancellationReason(code, 'seller')).toBe('You cancelled this trade.');
    }
  });

  it('requested_by_customer stays neutral for the buyer (admin force-cancel also writes it)', () => {
    expect(getFriendlyCancellationReason('requested_by_customer', 'buyer')).toBe(
      GENERIC_CANCELLATION_COPY
    );
    expect(getFriendlyCancellationReason('requested_by_customer', 'seller')).toBe(
      'This trade was cancelled at the buyer\u2019s request.'
    );
  });
});

describe('isDisputeRefundCancelled', () => {
  it('true only for cancelled + dispute_resolved_refund', () => {
    expect(
      isDisputeRefundCancelled({ status: 'cancelled', cancellation_reason: 'dispute_resolved_refund' })
    ).toBe(true);
    expect(
      isDisputeRefundCancelled({ status: 'completed', cancellation_reason: 'dispute_resolved_refund' })
    ).toBe(false);
    expect(
      isDisputeRefundCancelled({ status: 'cancelled', cancellation_reason: 'seller_declined' })
    ).toBe(false);
    expect(isDisputeRefundCancelled({ status: 'cancelled', cancellation_reason: null })).toBe(false);
  });
});
