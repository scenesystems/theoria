export { RunIdleState } from "./idle-state.js"
export { RunInFlightState } from "./in-flight-state.js"
export { RunFailedState, RunSuccessState } from "./terminal-state.js"

import type { RunIdleState } from "./idle-state.js"
import type { RunInFlightState } from "./in-flight-state.js"
import type { RunFailedState, RunSuccessState } from "./terminal-state.js"

export type RunState = RunIdleState | RunInFlightState | RunFailedState | RunSuccessState
