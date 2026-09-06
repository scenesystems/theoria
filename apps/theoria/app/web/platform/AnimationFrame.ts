import { Effect } from "effect"
import { cancelFrame, frame } from "motion"

/**
 * Suspends until the next frame's read step, scheduled through Motion's
 * render batcher so app code shares one frame loop with every animation.
 * Scroll and focus work after navigation waits here so the new route has
 * committed to the document first.
 *
 * @since 0.2.0
 */
export const nextFrame: Effect.Effect<void> = Effect.async<void>((resume) => {
  const process = frame.read(() => {
    resume(Effect.void)
  })

  return Effect.sync(() => {
    cancelFrame(process)
  })
})
