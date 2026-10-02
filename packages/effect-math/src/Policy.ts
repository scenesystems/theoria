/**
 * Defines runtime policy services shared by policy-aware computations.
 *
 * @since 0.1.0
 * @module
 */
import { Context, Effect, Layer, Schema } from "effect"

const FiniteInteger = Schema.Number.check(Schema.isFinite(), Schema.isInt())
const PrecisionValue = Schema.Literals(["strict", "relaxed"])
const BackendValue = Schema.Literals(["compensated", "scalar"])
const DiagnosticsValue = Schema.Literals(["enabled", "disabled"])

/**
 * Brands non-negative finite integers used to reproduce random streams.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Seed = FiniteInteger.check(Schema.isGreaterThanOrEqualTo(0)).annotate({
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
export const RandomnessPolicy = Schema.Union([
  Schema.Struct({ policy: Schema.Literals(["deterministic"]), seed: Seed }),
  Schema.Struct({ policy: Schema.Literals(["nondeterministic"]) })
]).annotate({ identifier: "@scenesystems/effect-math/Policy/RandomnessPolicy" })

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
export const PrecisionPolicy = Schema.Struct({ policy: PrecisionValue }).annotate({
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
export const BackendPolicy = Schema.Struct({ policy: BackendValue }).annotate({
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
export const DiagnosticsPolicy = Schema.Struct({ policy: DiagnosticsValue }).annotate({
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
}).annotate({ identifier: "@scenesystems/effect-math/Policy/Settings" })

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
export class Randomness
  extends Context.Service<Randomness, RandomnessPolicy>()("@scenesystems/effect-math/Policy/Randomness")
{}

/**
 * Supplies strict or relaxed result handling.
 *
 * @since 0.1.0
 * @category services
 */
export class Precision
  extends Context.Service<Precision, PrecisionPolicy>()("@scenesystems/effect-math/Policy/Precision")
{}

/**
 * Supplies backend preference metadata without allocating a backend.
 *
 * @since 0.1.0
 * @category services
 */
export class Backend extends Context.Service<Backend, BackendPolicy>()("@scenesystems/effect-math/Policy/Backend") {}

/**
 * Supplies the diagnostic logging policy.
 *
 * @since 0.1.0
 * @category services
 */
export class Diagnostics
  extends Context.Service<Diagnostics, DiagnosticsPolicy>()("@scenesystems/effect-math/Policy/Diagnostics")
{}

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
}).annotate({ identifier: "@scenesystems/effect-math/Policy/DeterministicOptions" })

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
}).annotate({ identifier: "@scenesystems/effect-math/Policy/NondeterministicOptions" })

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
