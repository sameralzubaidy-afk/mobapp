// File: p2p-kids-marketplace/src/components/trade/countdown.ts

export type CountdownUrgency = 'normal' | 'warning' | 'critical' | 'expired';

export interface CountdownModel {
  minutesLeft: number;
  hoursLeft: number;
  percentLeft: number;
  urgency: CountdownUrgency;
  expired: boolean;
}

function minutesFromDiffMs(diffMs: number): number {
  return Math.max(0, Math.ceil(diffMs / (60 * 1000)));
}

export function createCountdownModel(
  targetIso: string,
  startIso: string,
  nowMs = Date.now()
): CountdownModel {
  const targetMs = Date.parse(targetIso);
  const startMs = Date.parse(startIso);

  if (!Number.isFinite(targetMs) || !Number.isFinite(startMs) || targetMs <= startMs) {
    return {
      minutesLeft: 0,
      hoursLeft: 0,
      percentLeft: 0,
      urgency: 'expired',
      expired: true,
    };
  }

  const diffMs = targetMs - nowMs;
  const durationMs = targetMs - startMs;

  if (diffMs <= 0) {
    return {
      minutesLeft: 0,
      hoursLeft: 0,
      percentLeft: 0,
      urgency: 'expired',
      expired: true,
    };
  }

  const minutesLeft = minutesFromDiffMs(diffMs);
  const hoursLeft = Math.floor(minutesLeft / 60);
  const percentLeft = Math.min(100, Math.max(0, Math.round((diffMs / durationMs) * 100)));

  let urgency: CountdownUrgency = 'normal';
  if (minutesLeft <= 120) {
    urgency = 'critical';
  } else if (minutesLeft <= 360) {
    urgency = 'warning';
  }

  return {
    minutesLeft,
    hoursLeft,
    percentLeft,
    urgency,
    expired: false,
  };
}

export interface CountdownLabelOptions {
  /** DEV-TASK-113 (2026-09-05) item 7: omit the trailing " left" suffix for
   *  mid-sentence contexts ("Auto-completes in 48h") where "left" reads
   *  redundant. Standalone contexts (OfferCountdownPill) keep the default. */
  omitSuffix?: boolean;
}

export function formatCountdownLabel(
  model: CountdownModel,
  options: CountdownLabelOptions = {}
): string {
  if (model.expired) {
    return 'Expired';
  }

  const suffix = options.omitSuffix ? '' : ' left';
  if (model.hoursLeft >= 1) {
    const mins = model.minutesLeft % 60;
    if (mins === 0) {
      return `${model.hoursLeft}h${suffix}`;
    }
    return `${model.hoursLeft}h ${mins}m${suffix}`;
  }

  return `${model.minutesLeft}m${suffix}`;
}
