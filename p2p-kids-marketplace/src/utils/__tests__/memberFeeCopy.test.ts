/**
 * Unit Tests: memberFeeCopy — FIX-Task-47 item 4 (2026-09-16)
 *
 * The Kids Club+ flat member fee used to fall back to a hardcoded `149` in BOTH
 * `getActiveMemberFeeCents()` and `getDefaultConfig()`. A failed config read
 * therefore advertised a plausible-but-wrong $1.49 on every subscription surface —
 * undetectable by users and by QA. The reader now returns `null` and these
 * helpers render one explicit unavailable state.
 *
 * The load-bearing assertion is the `not.toContain('1.49')` sweep: it fails if any
 * branch ever re-introduces the old silent fallback.
 */

import {
  MEMBER_FEE_UNAVAILABLE,
  formatMemberFee,
  isMemberFeeAvailable,
  memberFeeBenefitText,
  memberFeeComparisonCell,
  memberFeePaymentLine,
} from '../memberFeeCopy';

describe('memberFeeCopy — FIX-Task-47 item 4 (no silent fee fallback)', () => {
  it('renders the live value (copy asserted by QA stays byte-identical)', () => {
    expect(formatMemberFee(149)).toBe('$1.49');
    expect(memberFeeBenefitText(149)).toBe('Flat $1.49 Safety & Platform Fee on every trade');
    expect(memberFeePaymentLine(149)).toBe('Pay a flat $1.49 Safety & Platform Fee on every trade');
    expect(memberFeeComparisonCell(149)).toBe('$1.49 flat');
  });

  it('treats an unreadable fee as UNAVAILABLE and never invents $1.49', () => {
    const unreadable = [null, undefined, NaN, Number.POSITIVE_INFINITY];

    for (const cents of unreadable) {
      expect(isMemberFeeAvailable(cents as never)).toBe(false);
      expect(formatMemberFee(cents as never)).toBe(MEMBER_FEE_UNAVAILABLE);
      expect(memberFeeBenefitText(cents as never)).toBe(
        'Flat Safety & Platform Fee on every trade'
      );
      expect(memberFeePaymentLine(cents as never)).toBe(
        'Pay a flat Safety & Platform Fee on every trade'
      );
      expect(memberFeeComparisonCell(cents as never)).toBe('Flat fee unavailable');

      // The regression guard: no branch may produce the old fallback figure.
      expect(formatMemberFee(cents as never)).not.toContain('1.49');
      expect(memberFeeBenefitText(cents as never)).not.toContain('1.49');
      expect(memberFeePaymentLine(cents as never)).not.toContain('1.49');
      expect(memberFeeComparisonCell(cents as never)).not.toContain('1.49');
    }
  });

  it('treats a configured 0 as a real value, not as unavailable', () => {
    expect(isMemberFeeAvailable(0)).toBe(true);
    expect(formatMemberFee(0)).toBe('$0');
  });

  it('rejects negative values as nonsense rather than rendering them', () => {
    expect(isMemberFeeAvailable(-1)).toBe(false);
    expect(formatMemberFee(-1)).toBe(MEMBER_FEE_UNAVAILABLE);
  });
});
