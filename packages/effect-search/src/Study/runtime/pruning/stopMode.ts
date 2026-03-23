/**
 * Stop mode schema and defaults controlling how pruned trials are terminated.
 *
 * @since 0.1.0
 */
import { Option, Schema } from "effect"

/**
 * @since 0.1.0
 * @category schemas
 */
export const StopModeSchema = Schema.Literal("Drain", "Interrupt")

/**
 * @since 0.1.0
 * @category type-level
 */
export type StopMode = Schema.Schema.Type<typeof StopModeSchema>

/**
 * @since 0.1.0
 * @category utils
 */
export const defaultStopMode = (): StopMode => "Drain"

/**
 * @since 0.1.0
 * @category utils
 */
export const stopModeOrDefault = (mode: Option.Option<StopMode>): StopMode => Option.getOrElse(mode, defaultStopMode)
