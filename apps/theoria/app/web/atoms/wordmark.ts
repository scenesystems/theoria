import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Effect } from "effect"

import { appRuntime } from "./runtime.js"

/**
 * Wordmark flip animation — drives per-character crossfade between
 * "Theoria" (Latin) and "θεωρία" (Greek).
 *
 * Each of the 6 semantic character units (Th↔θ, e↔ε, o↔ω, r↔ρ, i↔ί, a↔α)
 * crossfades independently with a left-to-right stagger.
 *
 * `segmentProgress(frame, index)` returns 0 (fully English) to 1 (fully Greek)
 * for each segment at a given frame.
 *
 * The animation loop uses `Effect.sleep` stepping (not `setInterval`),
 * yielding to React between frames through a shared mounted-wordmark loop.
 */

const HOLD_FRAMES = 30
const SWEEP_FRAMES = 24
const TOTAL_FRAMES = (HOLD_FRAMES + SWEEP_FRAMES) * 2
const SEGMENT_COUNT = 6
const STAGGER_FRACTION = 0.6
const FRAME_INTERVAL_MS = 80

const easeInOut = (t: number): number => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2

const mountDelta = (mounted: boolean): number => mounted ? 1 : -1

const nextWordmarkMountCount = ({
  mounted,
  currentCount
}: {
  readonly mounted: boolean
  readonly currentCount: number
}): number => Math.max(0, currentCount + mountDelta(mounted))

export const segmentProgress = (frame: number, segmentIndex: number): number => {
  const segmentOffset = (segmentIndex / (SEGMENT_COUNT - 1)) * STAGGER_FRACTION
  const segmentDuration = 1 - STAGGER_FRACTION

  const sweepT = frame < HOLD_FRAMES
    ? 0
    : frame < HOLD_FRAMES + SWEEP_FRAMES
    ? (frame - HOLD_FRAMES) / SWEEP_FRAMES
    : frame < HOLD_FRAMES * 2 + SWEEP_FRAMES
    ? 1
    : 1 - (frame - HOLD_FRAMES * 2 - SWEEP_FRAMES) / SWEEP_FRAMES

  const localT = Math.max(0, Math.min(1, (sweepT - segmentOffset) / segmentDuration))
  return easeInOut(localT)
}

export const wordmarkFrameAtom: AtomType.Writable<number> = Atom.make(0).pipe(Atom.keepAlive)
const wordmarkMountCountAtom: AtomType.Writable<number> = Atom.make(0).pipe(Atom.keepAlive)

/**
 * Shared animation loop that stays alive while at least one mounted wordmark
 * is subscribed to it.
 *
 * @since 0.1.0
 */
const runWordmarkLoopAtom = appRuntime.fn(
  Effect.fnUntraced(function*(_: void, ctx: AtomType.FnContext) {
    const registry = ctx.registry

    registry.set(wordmarkFrameAtom, 0)

    const loop = (frame: number): Effect.Effect<void, never, never> =>
      Effect.gen(function*() {
        if (registry.get(wordmarkMountCountAtom) === 0) {
          registry.set(wordmarkFrameAtom, 0)
          return
        }

        registry.set(wordmarkFrameAtom, frame % TOTAL_FRAMES)
        yield* Effect.sleep(`${FRAME_INTERVAL_MS} millis`)
        yield* loop(frame + 1)
      })

    yield* loop(0)
  })
).pipe(Atom.keepAlive)

/**
 * Registers mounted wordmark instances against the shared animation loop.
 * The loop starts on the first mount and is interrupted after the last unmount.
 *
 * @since 0.1.0
 */
export const setWordmarkMountedAtom = Atom.fnSync(function(mounted: boolean, ctx: AtomType.FnContext) {
  const currentCount = ctx(wordmarkMountCountAtom)
  const nextCount = nextWordmarkMountCount({ mounted, currentCount })

  ctx.set(wordmarkMountCountAtom, nextCount)

  if (mounted && currentCount === 0 && nextCount > 0) {
    ctx.set(runWordmarkLoopAtom, undefined)
    return
  }

  if (!mounted && nextCount === 0) {
    ctx.set(runWordmarkLoopAtom, Atom.Interrupt)
    ctx.set(wordmarkFrameAtom, 0)
  }
})
