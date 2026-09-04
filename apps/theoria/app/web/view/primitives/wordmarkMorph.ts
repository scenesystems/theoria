/**
 * Timing for the wordmark crossfade between "Theoria" and "θεωρία".
 *
 * Each of the six character units (Th↔θ, e↔ε, o↔ω, r↔ρ, i↔ί, a↔α) crossfades
 * on its own with a left-to-right stagger. One cycle holds Latin, sweeps to
 * Greek, holds Greek and sweeps back. Time is expressed in frames of
 * `frameIntervalMs` so the curve is independent of the display's refresh rate;
 * fractional frames are valid and give the smooth motion.
 */

const HOLD_FRAMES = 30
const SWEEP_FRAMES = 24
const SEGMENT_COUNT = 6
const STAGGER_FRACTION = 0.6

export const frameIntervalMs = 80
export const totalFrames = (HOLD_FRAMES + SWEEP_FRAMES) * 2

const easeInOut = (t: number): number => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2

/** Where the whole word is in its cycle: 0 fully Latin, 1 fully Greek, before the stagger is applied. */
const sweepAt = (frame: number): number =>
  frame < HOLD_FRAMES
    ? 0
    : frame < HOLD_FRAMES + SWEEP_FRAMES
    ? (frame - HOLD_FRAMES) / SWEEP_FRAMES
    : frame < HOLD_FRAMES * 2 + SWEEP_FRAMES
    ? 1
    : 1 - (frame - HOLD_FRAMES * 2 - SWEEP_FRAMES) / SWEEP_FRAMES

/** How Greek segment `segmentIndex` is at `frame` within a cycle: 0 fully Latin, 1 fully Greek. */
export const segmentProgress = (frame: number, segmentIndex: number): number => {
  const segmentOffset = (segmentIndex / (SEGMENT_COUNT - 1)) * STAGGER_FRACTION
  const segmentDuration = 1 - STAGGER_FRACTION
  const localT = Math.max(0, Math.min(1, (sweepAt(frame) - segmentOffset) / segmentDuration))

  return easeInOut(localT)
}

/** The frame within the cycle for `elapsedMs` since the animation started. */
export const frameAt = (elapsedMs: number): number => (elapsedMs / frameIntervalMs) % totalFrames
