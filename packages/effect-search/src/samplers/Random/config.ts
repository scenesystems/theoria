/**
 * Random sampler config accumulator — HashMap-backed parameter collection during suggestion.
 *
 * @since 0.1.0
 */
import { HashMap, Record } from "effect"

/** @since 0.1.0 */
export type ConfigValues = HashMap.HashMap<string, unknown>

/** @since 0.1.0 */
export const emptyConfigValues = (): ConfigValues => HashMap.empty<string, unknown>()

/** @since 0.1.0 */
export const setConfigValue = (raw: ConfigValues, key: string, value: unknown): ConfigValues =>
  HashMap.set(raw, key, value)

/** @since 0.1.0 */
export const configObject = (raw: ConfigValues): unknown => Record.fromEntries(HashMap.toEntries(raw))
