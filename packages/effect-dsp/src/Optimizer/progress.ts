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

/**
 * Shared optimizer outcome summaries and observability projections.
 *
 * @since 0.2.0
 */
export * from "./summary.js"

/**
 * BootstrapFewShot progress lines, event summaries, and sink contracts.
 *
 * @since 0.2.0
 */
export * from "../optimizers/BootstrapFewShot/progress.js"

/**
 * COPRO progress lines, event summaries, and sink contracts.
 *
 * @since 0.2.0
 */
export * from "../optimizers/COPRO/progress.js"

/**
 * GEPA progress lines, event summaries, and sink contracts.
 *
 * @since 0.2.0
 */
export * from "../optimizers/GEPA/progress.js"

/**
 * MIPROv2 progress lines, event summaries, and sink contracts.
 *
 * @since 0.2.0
 */
export * from "../optimizers/MIPROv2/progress.js"

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
