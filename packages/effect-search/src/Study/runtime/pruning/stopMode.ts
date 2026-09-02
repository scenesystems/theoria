/**
 * Cooperative behavior for trial-attributed study stop requests.
 *
 * @since 0.1.0
 */
import { Option, Schema } from "effect"

/**
 * Accepts `Drain`, which stops admitting work while allowing active trials to
 * finish, or `Interrupt`, which exposes a stop decision through active trial
 * heartbeats. Objectives must poll the heartbeat and stop themselves; the mode
 * does not interrupt their fibers. Omitted modes resolve to `Drain`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StopModeSchema = Schema.Literal("Drain", "Interrupt")

/**
 * Selects draining or cooperative interruption after a trial requests study
 * termination.
 *
 * @since 0.1.0
 * @category type-level
 */
export type StopMode = Schema.Schema.Type<typeof StopModeSchema>

/**
 * Resolves the default to `"Drain"`, allowing active trials to finish.
 *
 * @since 0.1.0
 * @category constructors
 */
export const defaultStopMode = (): StopMode => "Drain"

/**
 * Returns the present mode or `"Drain"` for `Option.none()`.
 *
 * @since 0.1.0
 * @category constructors
 */
export const stopModeOrDefault = (mode: Option.Option<StopMode>): StopMode => Option.getOrElse(mode, defaultStopMode)
