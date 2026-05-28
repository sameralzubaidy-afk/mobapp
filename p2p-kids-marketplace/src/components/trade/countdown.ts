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

export function formatCountdownLabel(model: CountdownModel): string {
  if (model.expired) {
    return 'Expired';
  }

  if (model.hoursLeft >= 1) {
    const mins = model.minutesLeft % 60;
    if (mins === 0) {
      return `${model.hoursLeft}h left`;
    }
    return `${model.hoursLeft}h ${mins}m left`;
  }

  return `${model.minutesLeft}m left`;
}
