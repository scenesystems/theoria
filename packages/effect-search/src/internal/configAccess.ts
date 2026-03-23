import { Option, Schema } from "effect"

/**
 * Schema for sampler-layer configs.
 *
 * Samplers produce configs by assembling `Record.fromEntries` from parameter
 * name/value pairs. This schema captures that invariant: configs are always
 * string-keyed records at the sampler boundary, even though the public API
 * uses a generic `Config` type parameter.
 *
 * Typed `Config` decode happens once at the study boundary (trialReservation).
 *
 * @since 0.1.0
 */
export const SamplerConfigSchema = Schema.Record({ key: Schema.String, value: Schema.Unknown })

/**
 * @since 0.1.0
 */
export type SamplerConfig = Schema.Schema.Type<typeof SamplerConfigSchema>

/**
 * Safe property access on a sampler config record.
 *
 * Single-source implementation for extracting a named parameter value
 * from a trial config in the sampler/TPE layer.
 */
export const valueFromConfig = (config: SamplerConfig, name: string): Option.Option<unknown> =>
  Option.fromNullable(config[name])
