export interface RestTimerSnapshot {
  durationSeconds: number;
  startedAt: number;
}

export function getRestTimerElapsedSeconds(timer: RestTimerSnapshot, now = Date.now()): number {
  return Math.max(0, Math.floor((now - timer.startedAt) / 1000));
}

export function getRestTimerRemainingSeconds(timer: RestTimerSnapshot, now = Date.now()): number {
  return Math.max(0, timer.durationSeconds - getRestTimerElapsedSeconds(timer, now));
}

export function addRestTimerSeconds(
  timer: RestTimerSnapshot,
  seconds: number,
): RestTimerSnapshot {
  return {
    ...timer,
    durationSeconds: Math.max(1, timer.durationSeconds + seconds),
  };
}

export function isRestTimerDone(timer: RestTimerSnapshot, now = Date.now()): boolean {
  return getRestTimerRemainingSeconds(timer, now) === 0;
}
