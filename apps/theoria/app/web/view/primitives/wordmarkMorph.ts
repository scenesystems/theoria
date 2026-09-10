/**
 * Timing for the wordmark crossfade between "Theoria" and "θεωρία".
 *
 * Each of the six character units (Th↔θ, e↔ε, o↔ω, r↔ρ, i↔ί, a↔α) crossfades
 * on its own with a left-to-right stagger. One cycle holds Latin, sweeps to
 * Greek, holds Greek and sweeps back. Time is expressed in frames of
 * `frameIntervalMs` so the curve is independent of the display's refresh rate;
 * fractional frames are valid and give the smooth motion.
 *
 * The wordmark plays the cycle once when the session begins and then rests on
 * its Latin face; meeting it (pointer or keyboard) plays one more pass. The
 * pass is the cycle after its lead hold, handed to Motion as keyframes so no
 * clock runs while the wordmark rests.
 */

import { Match, Schema } from "effect"
import * as Arr from "effect/Array"

import type { MotionPreference } from "../../atoms/motion.js"

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

const secondsOf = (frames: number): number => frames * frameIntervalMs / 1_000

/** The intro waits out the cycle's lead hold before its pass begins. */
export const introDelaySeconds = secondsOf(HOLD_FRAMES)

/** One pass: the sweep to Greek, the Greek hold and the sweep back. */
export const passSeconds = secondsOf(totalFrames - HOLD_FRAMES)

/** Motion's easing between one keyframe and the next: the holds are flat, the sweeps eased. */
export type SweepEase = "linear" | "easeInOut"

/**
 * The pass as keyframes for segment `segmentIndex`: the Greek face's opacity at
 * each moment, the Latin face's (its complement), the moments as fractions of
 * the pass, and the easing between consecutive moments. The moments are where
 * `segmentProgress` leaves and reaches its holds, so the keyframes are the same
 * curve the cycle describes.
 */
export const segmentPass = (segmentIndex: number): {
  readonly greek: ReadonlyArray<number>
  readonly latin: ReadonlyArray<number>
  readonly times: ReadonlyArray<number>
  readonly ease: ReadonlyArray<SweepEase>
} => {
  const segmentOffset = (segmentIndex / (SEGMENT_COUNT - 1)) * STAGGER_FRACTION
  const segmentDuration = 1 - STAGGER_FRACTION
  const passFrames = totalFrames - HOLD_FRAMES
  const inPass = (cycleFrame: number): number => (cycleFrame - HOLD_FRAMES) / passFrames
  const greek = [0, 0, 1, 1, 0, 0]

  return {
    ease: ["linear", "easeInOut", "linear", "easeInOut", "linear"],
    greek,
    latin: Arr.map(greek, (opacity) => 1 - opacity),
    times: [
      0,
      inPass(HOLD_FRAMES + segmentOffset * SWEEP_FRAMES),
      inPass(HOLD_FRAMES + (segmentOffset + segmentDuration) * SWEEP_FRAMES),
      inPass(HOLD_FRAMES * 2 + SWEEP_FRAMES + (1 - segmentOffset - segmentDuration) * SWEEP_FRAMES),
      inPass(HOLD_FRAMES * 2 + SWEEP_FRAMES + (1 - segmentOffset) * SWEEP_FRAMES),
      1
    ]
  }
}

/** Where the wordmark is: playing its first pass, playing one it was asked for, or resting Latin. */
export const WordmarkPhase = Schema.Literal("intro", "pass", "rest")
export type WordmarkPhase = typeof WordmarkPhase.Type

/** What happens to the wordmark: a reader meets it, or a pass it was playing ends. */
export const WordmarkEvent = Schema.Literal("replayAsked", "passEnded")
export type WordmarkEvent = typeof WordmarkEvent.Type

/** A pass that ends comes to rest; only a resting wordmark plays again, a running pass is left to finish. */
export const wordmarkPhaseAfter = (phase: WordmarkPhase, event: WordmarkEvent): WordmarkPhase =>
  Match.value(event).pipe(
    Match.when("passEnded", (): WordmarkPhase => "rest"),
    Match.when("replayAsked", (): WordmarkPhase => phase === "rest" ? "pass" : phase),
    Match.exhaustive
  )

/** What the wordmark does: crossfades through its cycle, or stands still on the Latin face. */
export const WordmarkMotion = Schema.Literal("crossfading", "still")
export type WordmarkMotion = typeof WordmarkMotion.Type

/** The wordmark stands still when the reader's system asks for less motion. */
export const wordmarkMotion = (preference: MotionPreference): WordmarkMotion =>
  Match.value(preference).pipe(
    Match.when("full", (): WordmarkMotion => "crossfading"),
    Match.when("reduced", (): WordmarkMotion => "still"),
    Match.exhaustive
  )
