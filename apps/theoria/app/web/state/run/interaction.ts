import type { RunState } from "./types.js"

export const runUsesActiveFrameAuthority = (run: RunState): boolean => run._tag !== "RunIdle"

export const runShowsAnimatingState = (
  run: RunState,
  isAnimating: boolean
): boolean => isAnimating && run._tag === "RunRunning" && run.session.control !== "paused"
