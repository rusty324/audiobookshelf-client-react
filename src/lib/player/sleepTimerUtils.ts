/**
 * Where playback should resume after a sleep timer expires.
 *
 * A sleep timer usually fires some time after you have already drifted off, so
 * playback backs up by the configured amount rather than resuming exactly where
 * it stopped. Clamped to zero so a timer firing near the start of a book cannot
 * seek to a negative position.
 *
 * @param currentTime - position playback stopped at, in seconds
 * @param rewindAmount - configured rewind, in seconds. 0 disables the rewind.
 * @returns the position to seek to, or null when no rewind should happen
 */
export function getAutoRewindTarget(currentTime: number, rewindAmount: number): number | null {
  if (!Number.isFinite(currentTime) || !Number.isFinite(rewindAmount) || rewindAmount <= 0) return null
  return Math.max(0, currentTime - rewindAmount)
}

/** Rewind amounts offered in the sleep timer modal, in seconds. 0 is "Off". */
export const AUTO_REWIND_AMOUNTS = [0, 5, 10, 15, 30, 60] as const
