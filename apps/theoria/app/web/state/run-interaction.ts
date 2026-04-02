import { Match } from "effect"

import type { RunState } from "./surface-state.js"

export const runUsesActiveFrameAuthority = (run: RunState): boolean =>
  Match.value(run._tag).pipe(
    Match.when("RunRunning", () => true),
    Match.when("RunStopping", () => true),
    Match.orElse(() => false)
  )

export const runShowsAnimatingState = (
  run: RunState,
  isAnimating: boolean
): boolean => isAnimating && runUsesActiveFrameAuthority(run)
