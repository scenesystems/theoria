/**
 * Defines runtime policy services shared by policy-aware computations.
 *
 * @since 0.1.0
 * @module
 */
import { Context, Effect, Layer, Schema } from "effect"

const FiniteInteger = Schema.Number.pipe(Schema.finite(), Schema.int())
const PrecisionValue = Schema.Literal("strict", "relaxed")
const BackendValue = Schema.Literal("compensated", "scalar")
const DiagnosticsValue = Schema.Literal("enabled", "disabled")

/**
 * Brands non-negative finite integers used to reproduce random streams.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Seed = FiniteInteger.pipe(Schema.greaterThanOrEqualTo(0)).annotations({
  identifier: "@scenesystems/effect-math/Policy/Seed"
}).pipe(Schema.brand("@scenesystems/effect-math/Policy/Seed"))

/**
 * A decoded non-negative integer accepted by deterministic policy layers.
 *
 * @since 0.1.0
 * @category models
 */
export type Seed = typeof Seed.Type

/**
 * Accepts nondeterministic selection or deterministic selection with a seed.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RandomnessPolicy = Schema.Union(
  Schema.Struct({ policy: Schema.Literal("deterministic"), seed: Seed }),
  Schema.Struct({ policy: Schema.Literal("nondeterministic") })
).annotations({ identifier: "@scenesystems/effect-math/Policy/RandomnessPolicy" })

/**
 * Decoded randomness selection metadata, including a seed only for the
 * deterministic branch.
 *
 * @since 0.1.0
 * @category models
 */
export type RandomnessPolicy = typeof RandomnessPolicy.Type

/**
 * Accepts strict or relaxed floating-point result handling.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PrecisionPolicy = Schema.Struct({ policy: PrecisionValue }).annotations({
  identifier: "@scenesystems/effect-math/Policy/PrecisionPolicy"
})

/**
 * Decoded strict or relaxed floating-point result policy metadata.
 *
 * @since 0.1.0
 * @category models
 */
export type PrecisionPolicy = typeof PrecisionPolicy.Type

/**
 * Accepts scalar-first or compensated-first backend preference.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BackendPolicy = Schema.Struct({ policy: BackendValue }).annotations({
  identifier: "@scenesystems/effect-math/Policy/BackendPolicy"
})

/**
 * Decoded compensated-first or scalar-first backend preference metadata.
 *
 * @since 0.1.0
 * @category models
 */
export type BackendPolicy = typeof BackendPolicy.Type

/**
 * Accepts whether policy-aware computations may emit diagnostic logs.
 *
 * @since 0.1.0
 * @category schemas
 */
export const DiagnosticsPolicy = Schema.Struct({ policy: DiagnosticsValue }).annotations({
  identifier: "@scenesystems/effect-math/Policy/DiagnosticsPolicy"
})

/**
 * Decoded diagnostic logging selection metadata.
 *
 * @since 0.1.0
 * @category models
 */
export type DiagnosticsPolicy = typeof DiagnosticsPolicy.Type

/**
 * Accepts one randomness, precision, backend, and diagnostics policy snapshot.
 *
 * The aggregate records configuration only: it constructs no random-number
 * generator or backend and emits no diagnostics.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Settings = Schema.Struct({
  rngPolicy: RandomnessPolicy,
  precisionPolicy: PrecisionPolicy,
  backendPolicy: BackendPolicy,
  diagnosticsPolicy: DiagnosticsPolicy
}).annotations({ identifier: "@scenesystems/effect-math/Policy/Settings" })

/**
 * A decoded aggregate of the four runtime policy service values.
 *
 * @since 0.1.0
 * @category models
 */
export type Settings = typeof Settings.Type

/**
 * Supplies randomness policy metadata without constructing a generator.
 *
 * @since 0.1.0
 * @category services
 */
export class Randomness extends Context.Tag("@scenesystems/effect-math/Policy/Randomness")<
  Randomness,
  RandomnessPolicy
>() {}

/**
 * Supplies strict or relaxed result handling.
 *
 * @since 0.1.0
 * @category services
 */
export class Precision
  extends Context.Tag("@scenesystems/effect-math/Policy/Precision")<Precision, PrecisionPolicy>()
{}

/**
 * Supplies backend preference metadata without allocating a backend.
 *
 * @since 0.1.0
 * @category services
 */
export class Backend extends Context.Tag("@scenesystems/effect-math/Policy/Backend")<Backend, BackendPolicy>() {}

/**
 * Supplies the diagnostic logging policy.
 *
 * @since 0.1.0
 * @category services
 */
export class Diagnostics extends Context.Tag("@scenesystems/effect-math/Policy/Diagnostics")<
  Diagnostics,
  DiagnosticsPolicy
>() {}

/**
 * Accepts the seed and policy values captured by a deterministic policy layer.
 *
 * @since 0.1.0
 * @category schemas
 */
export const DeterministicOptions = Schema.Struct({
  seed: Seed,
  precision: PrecisionValue,
  backend: BackendValue,
  diagnostics: DiagnosticsValue
}).annotations({ identifier: "@scenesystems/effect-math/Policy/DeterministicOptions" })

/**
 * Decoded configuration for all deterministic runtime policy services.
 *
 * @since 0.1.0
 * @category models
 */
export type DeterministicOptions = typeof DeterministicOptions.Type

/**
 * Accepts the policy values captured by a layer without a reproducibility seed.
 *
 * @since 0.1.0
 * @category schemas
 */
export const NondeterministicOptions = Schema.Struct({
  precision: PrecisionValue,
  backend: BackendValue,
  diagnostics: DiagnosticsValue
}).annotations({ identifier: "@scenesystems/effect-math/Policy/NondeterministicOptions" })

/**
 * Decoded configuration for all nondeterministic runtime policy services.
 *
 * @since 0.1.0
 * @category models
 */
export type NondeterministicOptions = typeof NondeterministicOptions.Type

/**
 * Builds all policy services with a reproducible seed.
 *
 * The typed options are not decoded. The resource-free layer records the seed
 * but does not construct or advance a random-number generator.
 *
 * @since 0.1.0
 * @category layers
 */
export const layerDeterministic = (options: DeterministicOptions) =>
  Layer.mergeAll(
    Layer.succeed(Randomness, { policy: "deterministic", seed: options.seed }),
    Layer.succeed(Precision, { policy: options.precision }),
    Layer.succeed(Backend, { policy: options.backend }),
    Layer.succeed(Diagnostics, { policy: options.diagnostics })
  )

/**
 * Builds all policy services without a reproducibility seed.
 *
 * The typed options are not decoded. The resource-free layer delegates all
 * nondeterministic generation to consumers of {@link Randomness}.
 *
 * @since 0.1.0
 * @category layers
 */
export const layerNondeterministic = (options: NondeterministicOptions) =>
  Layer.mergeAll(
    Layer.succeed(Randomness, { policy: "nondeterministic" }),
    Layer.succeed(Precision, { policy: options.precision }),
    Layer.succeed(Backend, { policy: options.backend }),
    Layer.succeed(Diagnostics, { policy: options.diagnostics })
  )

/**
 * Reads the four current policy services without decoding or allocation.
 *
 * Each execution snapshots the values in its Effect context; collecting them
 * performs no random generation, backend dispatch, validation, or logging.
 *
 * @since 0.1.0
 * @category accessors
 */
export const snapshot: Effect.Effect<Settings, never, Randomness | Precision | Backend | Diagnostics> = Effect.all({
  rngPolicy: Randomness,
  precisionPolicy: Precision,
  backendPolicy: Backend,
  diagnosticsPolicy: Diagnostics
})
