/**
 * Reusable optimizer progress and summary abstractions.
 *
 * @since 0.1.0
 */
import { Effect } from "effect"
import type { BootstrapProgressSink } from "../optimizers/BootstrapFewShot/progress.js"
import type { COPROProgressSink } from "../optimizers/COPRO/progress.js"
import type { GEPAProgressSink } from "../optimizers/GEPA/progress.js"
import type { MIPROv2ProgressSink } from "../optimizers/MIPROv2/progress.js"

export { GEPAOutcomeSummary, MIPROv2OptimizationObservability, MIPROv2OutcomeSummary } from "./summary.js"

export { BootstrapEventSummary, BootstrapProgressLine } from "../optimizers/BootstrapFewShot/progress.js"

export { COPROEventSummary, COPROProgressLine } from "../optimizers/COPRO/progress.js"

export { GEPAEventSummary, GEPAProgressLine } from "../optimizers/GEPA/progress.js"

export { MIPROv2EventSummary, MIPROv2ProgressLine } from "../optimizers/MIPROv2/progress.js"

export type { BootstrapProgressSink } from "../optimizers/BootstrapFewShot/progress.js"

export type { COPROProgressSink } from "../optimizers/COPRO/progress.js"

export type { GEPAProgressSink } from "../optimizers/GEPA/progress.js"

export type { MIPROv2ProgressSink } from "../optimizers/MIPROv2/progress.js"

const noOpProgressEffect = Effect.void

/**
 * No-op progress sink for BootstrapFewShot streams.
 *
 * @since 0.1.0
 * @category constants
 */
export const noBootstrapProgress: BootstrapProgressSink = () => noOpProgressEffect

/**
 * No-op progress sink for COPRO streams.
 *
 * @since 0.2.0
 * @category constants
 */
export const noCOPROProgress: COPROProgressSink = () => noOpProgressEffect

/**
 * No-op progress sink for MIPROv2 streams.
 *
 * @since 0.1.0
 * @category constants
 */
export const noMIPROv2Progress: MIPROv2ProgressSink = () => noOpProgressEffect

/**
 * No-op progress sink for GEPA streams.
 *
 * @since 0.1.0
 * @category constants
 */
export const noGEPAProgress: GEPAProgressSink = () => noOpProgressEffect
