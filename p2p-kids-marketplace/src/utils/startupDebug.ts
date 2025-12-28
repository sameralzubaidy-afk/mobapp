let lastStep = '';

export function setStartupStep(step: string) {
  lastStep = step;
}

export function getStartupStep() {
  return lastStep;
}

export function clearStartupStep() {
  lastStep = '';
}
