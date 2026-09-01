/**
 * Stop mode schema and defaults controlling how pruned trials are terminated.
 *
 * @since 0.1.0
 */
import { Option, Schema } from "effect"

/**
 * Accepts `Drain`, which stops admitting work while allowing active trials to
 * finish, or `Interrupt`, which requests immediate interruption. Omitted modes
 * are resolved to `Drain` by {@link stopModeOrDefault}.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StopModeSchema = Schema.Literal("Drain", "Interrupt")

/**
 * The draining or immediate interruption behavior used to stop a study.
 *
 * @since 0.1.0
 * @category type-level
 */
export type StopMode = Schema.Schema.Type<typeof StopModeSchema>

/**
 * Returns the default draining stop mode.
 *
 * @since 0.1.0
 * @category constructors
 */
export const defaultStopMode = (): StopMode => "Drain"

/**
 * Returns an optional stop mode or the default draining mode.
 *
 * @since 0.1.0
 * @category constructors
 */
export const stopModeOrDefault = (mode: Option.Option<StopMode>): StopMode => Option.getOrElse(mode, defaultStopMode)
