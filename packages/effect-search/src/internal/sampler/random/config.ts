/**
 * Random sampler config accumulator — HashMap-backed parameter collection during suggestion.
 *
 * @since 0.1.0
 */
import { HashMap, Record } from "effect"

/**
 * Immutable HashMap accumulating sampled parameter name–value pairs during
 * random suggestion construction.
 *
 * Uses `HashMap` rather than a plain record so intermediate states share
 * structure efficiently during the parameter fold.
 *
 * @see {@link emptyConfigValues} for creating a fresh accumulator
 * @see {@link configObject} for materializing to a plain record
 * @since 0.1.0
 * @category models
 */
export type ConfigValues = HashMap.HashMap<string, unknown>

/**
 * Creates an empty parameter accumulator to begin collecting sampled values
 * for a new configuration.
 *
 * @see {@link setConfigValue} for adding parameter values
 * @since 0.1.0
 * @category constructors
 */
export const emptyConfigValues = (): ConfigValues => HashMap.empty<string, unknown>()

/**
 * Inserts or overwrites a single parameter value in the accumulator,
 * returning an updated immutable HashMap.
 *
 * @see {@link configObject} for materializing the final record
 * @since 0.1.0
 * @category constructors
 */
export const setConfigValue = (raw: ConfigValues, key: string, value: unknown): ConfigValues =>
  HashMap.set(raw, key, value)

/**
 * Materializes the accumulated HashMap into a plain record suitable for
 * sampler output and conditional-activation checks.
 *
 * @see {@link ConfigValues} for the source accumulator type
 * @since 0.1.0
 * @category constructors
 */
export const configObject = (raw: ConfigValues): unknown => Record.fromEntries(HashMap.toEntries(raw))
