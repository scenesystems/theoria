/**
 * Sampling strategies, suggestion context, and resumable state.
 *
 * @since 0.7.0
 * @module
 */
import { Array as Arr, Chunk, Data, Effect, type HashMap, Option, Schema } from "effect"
import { dual } from "effect/Function"

import type * as Acquisition from "./Acquisition.js"
import { Name as AcquisitionName } from "./Acquisition.js"
import { constantLiar } from "./internal/constantLiar.js"
import * as Constructors from "./internal/sampler/constructors.js"
import * as Deterministic from "./internal/sampler/deterministic.js"
import * as Stratified from "./internal/sampler/stratified.js"
import * as Weighted from "./internal/sampler/weighted.js"
import { match as matchObjective, Objective, single, Value, type Vector } from "./Objective.js"
import type { InvalidStudyConfig, SearchError } from "./SearchError.js"
import type * as SearchSpace from "./SearchSpace.js"

/** Random-sampler configuration. @since 0.7.0 @category schemas */
export const RandomOptions = Schema.Struct({ seed: Schema.optional(Schema.Number) })
/** Random-sampler configuration. @since 0.7.0 @category models */
export type RandomOptions = typeof RandomOptions.Type

/** Finite-grid configuration. @since 0.7.0 @category schemas */
export const GridOptions = Schema.Struct({
  shuffle: Schema.optional(Schema.Boolean),
  seed: Schema.optional(Schema.Number)
})
/** Finite-grid configuration. @since 0.7.0 @category models */
export type GridOptions = typeof GridOptions.Type

/** CMA-ES configuration. @since 0.7.0 @category schemas */
export const CmaEsOptions = Schema.Struct({
  seed: Schema.optional(Schema.Number),
  sigma: Schema.optional(Schema.Number),
  populationSize: Schema.optional(Schema.Number)
})
/** CMA-ES configuration. @since 0.7.0 @category models */
export type CmaEsOptions = typeof CmaEsOptions.Type

/** Gaussian-process Bayesian-optimization configuration. @since 0.7.0 @category schemas */
export const GpBoOptions = Schema.Struct({
  seed: Schema.optional(Schema.Number),
  nStartupTrials: Schema.optional(Schema.Number),
  nCandidates: Schema.optional(Schema.Number),
  lengthScale: Schema.optional(Schema.Number),
  noise: Schema.optional(Schema.Number),
  acquisition: Schema.optional(AcquisitionName)
})
/** Gaussian-process Bayesian-optimization configuration. @since 0.7.0 @category models */
export type GpBoOptions = typeof GpBoOptions.Type

/** A constraint residual evaluator; values at or below zero are feasible. @since 0.7.0 @category models */
export type Constraint = (config: unknown) => Effect.Effect<number>

/**
 * TPE configuration, including runtime-only acquisition and constraint extensions.
 * Function-valued fields are intentionally excluded from checkpoints and sampler identity.
 * @since 0.7.0
 * @category models
 */
export class TpeOptions extends Data.Class<{
  readonly nStartupTrials?: number
  readonly nEiCandidates?: number
  readonly multivariate?: boolean
  readonly groupDimensions?: boolean
  readonly noiseAware?: boolean
  readonly noiseAlpha?: number
  readonly seed?: number
  readonly acquisition?: Acquisition.Strategy
  readonly constraints?: Iterable<Constraint>
}> {}

const PersistedTpeOptions = Schema.Struct({
  nStartupTrials: Schema.optional(Schema.Number),
  nEiCandidates: Schema.optional(Schema.Number),
  multivariate: Schema.optional(Schema.Boolean),
  groupDimensions: Schema.optional(Schema.Boolean),
  noiseAware: Schema.optional(Schema.Boolean),
  noiseAlpha: Schema.optional(Schema.Number),
  constraintsCount: Schema.optional(Schema.NonNegative),
  seed: Schema.optional(Schema.Number)
})

/** Built-in algorithm and normalized serializable options. @since 0.7.0 @category schemas */
export const Kind = Schema.Union(
  Schema.TaggedStruct("Random", { options: RandomOptions }),
  Schema.TaggedStruct("Grid", { options: GridOptions }),
  Schema.TaggedStruct("Tpe", { options: PersistedTpeOptions }),
  Schema.TaggedStruct("CmaEs", { options: CmaEsOptions }),
  Schema.TaggedStruct("GpBo", { options: GpBoOptions })
)
/** Built-in algorithm and normalized serializable options. @since 0.7.0 @category models */
export type Kind = typeof Kind.Type

const kinds = Data.taggedEnum<Kind>()
/** Constructs a random kind. @since 0.7.0 @category constructors */
export const Random = kinds.Random
/** Constructs a grid kind. @since 0.7.0 @category constructors */
export const Grid = kinds.Grid
/** Constructs a TPE kind. @since 0.7.0 @category constructors */
export const Tpe = kinds.Tpe
/** Constructs a CMA-ES kind. @since 0.7.0 @category constructors */
export const CmaEs = kinds.CmaEs
/** Constructs a GP-BO kind. @since 0.7.0 @category constructors */
export const GpBo = kinds.GpBo
/** Narrows a sampler kind. @since 0.7.0 @category guards */
export const isKind = kinds.$is
/** Exhaustively matches a sampler kind. @since 0.7.0 @category pattern-matching */
export const matchKind = kinds.$match

/** Resumable state for every built-in sampler. @since 0.7.0 @category schemas */
export const Checkpoint = Schema.Union(
  Schema.TaggedStruct("Random", { seed: Schema.Number }),
  Schema.TaggedStruct("Grid", { seed: Schema.Number, shuffle: Schema.Boolean }),
  Schema.TaggedStruct("Tpe", {
    seed: Schema.Number,
    nStartupTrials: Schema.Number,
    nEiCandidates: Schema.Number
  }),
  Schema.TaggedStruct("CmaEs", {
    seed: Schema.Number,
    sigma: Schema.Number,
    populationSize: Schema.Number
  }),
  Schema.TaggedStruct("GpBo", {
    seed: Schema.Number,
    nStartupTrials: Schema.Number,
    nCandidates: Schema.Number,
    lengthScale: Schema.Number,
    noise: Schema.Number,
    acquisition: Schema.optional(AcquisitionName)
  })
)
/** Resumable state for every built-in sampler. @since 0.7.0 @category models */
export type Checkpoint = typeof Checkpoint.Type

/** One completed observation supplied to a sampler. @since 0.7.0 @category schemas */
export class Observation extends Schema.Class<Observation>("effect-search/Sampler/Observation")({
  trialNumber: Schema.Number,
  config: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  value: Value,
  observationWeight: Schema.optional(Schema.Number),
  cost: Schema.optional(Schema.Number),
  variance: Schema.optional(Schema.Number),
  constraints: Schema.optional(Schema.Array(Schema.Number))
}) {}

/** One reserved configuration supplied to a sampler. @since 0.7.0 @category schemas */
export class Pending extends Schema.Class<Pending>("effect-search/Sampler/Pending")({
  trialNumber: Schema.Number,
  config: Schema.Record({ key: Schema.String, value: Schema.Unknown })
}) {}

/** Untyped sampler configuration keyed by parameter name. @since 0.7.0 @category models */
export type Config = Observation["config"]

const SuggestionEpsilon = Schema.NonNegative.pipe(Schema.filter(Number.isFinite))

/** Immutable inputs for one suggestion. @since 0.7.0 @category schemas */
export class Context extends Schema.Class<Context>("effect-search/Sampler/Context")({
  completed: Schema.Array(Observation),
  pending: Schema.Array(Pending),
  objectiveSpec: Objective,
  nextTrialNumber: Schema.Number,
  epsilon: SuggestionEpsilon
}) {}

/** Pending-trial imputation strategy. @since 0.7.0 @category models */
export class PendingPolicy extends Data.Class<{
  readonly name: string
  readonly impute: (context: Context) => Chunk.Chunk<Observation>
}> {}

/** Leaves pending reservations out of fitted observations. @since 0.7.0 @category constructors */
export const noPendingPolicy = new PendingPolicy({ name: "none", impute: Chunk.empty })

/** Assigns zero-valued observations to pending reservations. @since 0.7.0 @category constructors */
export const pendingAsZeroPolicy = new PendingPolicy({
  name: "pending-zero",
  impute: (context) => {
    const value = matchObjective({
      Single: () => 0,
      Multi: ({ directions }) => Arr.makeBy(directions.length, () => 0)
    })(context.objectiveSpec)

    return Chunk.fromIterable(Arr.map(context.pending, (entry) =>
      new Observation({
        trialNumber: entry.trialNumber,
        config: entry.config,
        value
      })))
  }
})

/** Uses a pessimistic completed value for each pending reservation. @since 0.7.0 @category constructors */
export const constantLiarPolicy = new PendingPolicy({ name: "constant-liar", impute: constantLiar })

/** Runtime sampler implementation. @since 0.7.0 @category models */
export class Sampler extends Data.Class<{
  readonly kind: Kind
  readonly pendingImputationPolicy: PendingPolicy
  readonly acquire?: Effect.Effect<void, SearchError>
  readonly release?: Effect.Effect<void>
  readonly suggest: (space: SearchSpace.SearchSpace, context: Context) => Effect.Effect<unknown, SearchError>
  readonly checkpoint: Effect.Effect<Checkpoint, SearchError>
  readonly restore: (checkpoint: Checkpoint) => Effect.Effect<void, InvalidStudyConfig>
}> {}

/** Suggested configuration reservation. @since 0.7.0 @category models */
export class Reservation extends Data.Class<{
  readonly trialNumber: number
  readonly config: Config
}> {}

/** Requests one suggestion. @since 0.7.0 @category combinators */
export const suggest: {
  (space: SearchSpace.SearchSpace, context: Context): (self: Sampler) => Effect.Effect<unknown, SearchError>
  (self: Sampler, space: SearchSpace.SearchSpace, context: Context): Effect.Effect<unknown, SearchError>
} = dual(3, (self: Sampler, space: SearchSpace.SearchSpace, context: Context) => self.suggest(space, context))

/** Captures resumable state. @since 0.7.0 @category combinators */
export const checkpoint = (self: Sampler): Effect.Effect<Checkpoint, SearchError> => self.checkpoint

/** Restores resumable state. @since 0.7.0 @category combinators */
export const restore: {
  (checkpoint: Checkpoint): (self: Sampler) => Effect.Effect<void, InvalidStudyConfig>
  (self: Sampler, checkpoint: Checkpoint): Effect.Effect<void, InvalidStudyConfig>
} = dual(2, (self: Sampler, checkpoint: Checkpoint) => self.restore(checkpoint))

/** Runs optional acquisition. @since 0.7.0 @category lifecycle */
export const acquire = (self: Sampler): Effect.Effect<void, SearchError> =>
  Option.fromNullable(self.acquire).pipe(Option.getOrElse(() => Effect.void))
/** Runs optional release. @since 0.7.0 @category lifecycle */
export const release = (self: Sampler): Effect.Effect<void> =>
  Option.fromNullable(self.release).pipe(Option.getOrElse(() => Effect.void))

/** Creates a random sampler. @since 0.7.0 @category constructors */
export const random = (options: RandomOptions = {}): Sampler => Constructors.random(options)
/** Creates a finite-grid sampler. @since 0.7.0 @category constructors */
export const grid = (options: GridOptions = {}): Sampler => Constructors.grid(options)
/** Creates a TPE sampler. @since 0.7.0 @category constructors */
export const tpe = (options: TpeOptions = {}): Sampler => Constructors.tpe(options)
/** Creates a CMA-ES sampler. @since 0.7.0 @category constructors */
export const cmaEs = (options: CmaEsOptions = {}): Sampler => Constructors.cmaEs(options)
/** Creates a GP-BO sampler. @since 0.7.0 @category constructors */
export const gpBo = (options: GpBoOptions = {}): Sampler => Constructors.gpBo(options)

/** Creates an empty suggestion context. @since 0.7.0 @category constructors */
export const emptyContext = (nextTrialNumber = 0): Context =>
  new Context({ completed: [], pending: [], objectiveSpec: single(), nextTrialNumber, epsilon: 0 })

/** Creates a completed observation. @since 0.7.0 @category constructors */
export const observation = (
  trialNumber: number,
  config: Config,
  value: Value,
  options: {
    readonly observationWeight?: number
    readonly cost?: number
    readonly variance?: number
    readonly constraints?: Iterable<number>
  } = {}
): Observation =>
  new Observation({
    trialNumber,
    config,
    value,
    ...Option.match(Option.fromNullable(options.observationWeight), {
      onNone: () => ({}),
      onSome: (observationWeight) => ({ observationWeight })
    }),
    ...Option.match(Option.fromNullable(options.cost), {
      onNone: () => ({}),
      onSome: (cost) => ({ cost })
    }),
    ...Option.match(Option.fromNullable(options.variance), {
      onNone: () => ({}),
      onSome: (variance) => ({ variance })
    }),
    ...Option.match(Option.fromNullable(options.constraints), {
      onNone: () => ({}),
      onSome: (constraints) => ({ constraints: Arr.fromIterable(constraints) })
    })
  })

/** Creates a pending reservation. @since 0.7.0 @category constructors */
export const pending = (trialNumber: number, config: Config): Pending => new Pending({ trialNumber, config })

/** Builds deterministic indices. @since 0.7.0 @category utilities */
export const buildIndices = (count: number): Vector => Deterministic.buildIndices(count)
/** Normalizes a deterministic seed. @since 0.7.0 @category utilities */
export const normalizeDeterministicSeed = (seed: number): number => Deterministic.normalizeDeterministicSeed(seed)
/** Advances a deterministic seed. @since 0.7.0 @category utilities */
export const nextDeterministicSeed = (seed: number): number => Deterministic.nextDeterministicSeed(seed)
/** Normalizes a positive count. @since 0.7.0 @category utilities */
export const normalizePositiveCount = (value: number): number => Deterministic.normalizePositiveCount(value)
/** Deterministically shuffles values. @since 0.7.0 @category utilities */
export const shuffleBySeed = <A>(values: Iterable<A>, seed: number): Chunk.Chunk<A> =>
  Chunk.fromIterable(Deterministic.shuffleBySeed(values, seed))
/** Samples a bounded count. @since 0.7.0 @category utilities */
export const sampleBoundedCount = (seed: number, maxCount: number): number =>
  Deterministic.sampleBoundedCount(seed, maxCount)
/** Samples deterministic weighted indices. @since 0.7.0 @category utilities */
export const sampleWeightedIndices = (
  weights: Iterable<WeightedIndex>,
  drawCount: number,
  seed: number
): Vector => Weighted.sampleWeightedIndices(weights, drawCount, seed)
/** Selects one weighted index. @since 0.7.0 @category utilities */
export const selectWeightedIndex = (weights: Iterable<WeightedIndex>, seed: number): number =>
  Weighted.selectWeightedIndex(weights, seed)
/** Selects one weighted index with fallback policy. @since 0.7.0 @category utilities */
export const selectWeightedIndexWithPolicy = (
  weights: Iterable<WeightedIndex>,
  seed: number,
  options?: SelectWeightedIndexOptions
): number => Weighted.selectWeightedIndexWithPolicy(weights, seed, options)
/** Samples a weighted pair. @since 0.7.0 @category utilities */
export const sampleWeightedPair = (
  weights: Iterable<WeightedIndex>,
  seed: number,
  options?: SampleWeightedPairOptions
) => Weighted.sampleWeightedPair(weights, seed, options)
/** Samples strata in round-robin order. @since 0.7.0 @category utilities */
export const sampleStratifiedRoundRobin = <Bucket, A>(
  options: StratifiedRoundRobinOptions<Bucket, A>
): Chunk.Chunk<A> => Stratified.sampleStratifiedRoundRobin(options)
/** Stratified selection options. @since 0.7.0 @category models */
export class StratifiedRoundRobinOptions<Bucket, Value> extends Data.Class<{
  readonly buckets: HashMap.HashMap<Bucket, Chunk.Chunk<Value>>
  readonly bucketOrder: Chunk.Chunk<Bucket>
  readonly targetSize: number
  readonly seed: number
}> {}
/** Weighted index schema. @since 0.7.0 @category schemas */
export const WeightedIndex = Schema.Struct({ index: Schema.Number, weight: Schema.Number })
/** Weighted index. @since 0.7.0 @category models */
export type WeightedIndex = typeof WeightedIndex.Type
/** Weighted zero fallback schema. @since 0.7.0 @category schemas */
export const WeightedZeroWeightFallback = Schema.Literal("lowest-index", "seed-modulo")
/** Weighted zero fallback. @since 0.7.0 @category models */
export type WeightedZeroWeightFallback = typeof WeightedZeroWeightFallback.Type
/** Weighted selection options. @since 0.7.0 @category schemas */
export const SelectWeightedIndexOptions = Schema.Struct({
  zeroWeightFallback: Schema.optional(WeightedZeroWeightFallback)
})
/** Weighted selection options. @since 0.7.0 @category models */
export type SelectWeightedIndexOptions = typeof SelectWeightedIndexOptions.Type
/** Weighted pair options. @since 0.7.0 @category schemas */
export const SampleWeightedPairOptions = Schema.Struct({
  distinct: Schema.optional(Schema.Boolean),
  zeroWeightFallback: Schema.optional(WeightedZeroWeightFallback)
})
/** Weighted pair options. @since 0.7.0 @category models */
export type SampleWeightedPairOptions = typeof SampleWeightedPairOptions.Type
