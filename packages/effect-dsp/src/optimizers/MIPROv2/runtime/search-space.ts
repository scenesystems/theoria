/**
 * Phase 3 search space construction — maps instruction×demo candidates into
 * effect-search dimensions.
 *
 * @since 0.0.0
 * @internal
 */
import { Array as Arr, Effect, Match, Option, Predicate, Record } from "effect"
import type { Schema } from "effect"
import type { Study } from "effect-search"
import { SearchSpace } from "effect-search"
import { AllTrialsFailed } from "../../../Errors/optimizer.js"
import { collectModuleParamRefs } from "../../../internal/module-params.js"
import type { Module as DspModule } from "../../../Module/model.js"
import type { PredictorDemoCandidates } from "../bootstrap.js"
import type { PredictorInstructionCandidates } from "../propose.js"
import {
  demoDimensionName,
  instructionDimensionName,
  type Phase3Config,
  type Phase3DimensionIndex,
  PredictorBinding
} from "./model.js"

type Phase3CategoricalSchema =
  | Schema.Schema<0>
  | Schema.Schema<0 | 1>
  | Schema.Schema<0 | 1 | 2>
  | Schema.Schema<0 | 1 | 2 | 3>
  | Schema.Schema<0 | 1 | 2 | 3 | 4>
  | Schema.Schema<0 | 1 | 2 | 3 | 4 | 5>
  | Schema.Schema<0 | 1 | 2 | 3 | 4 | 5 | 6>
  | Schema.Schema<0 | 1 | 2 | 3 | 4 | 5 | 6 | 7>
  | Schema.Schema<0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>
  | Schema.Schema<Phase3DimensionIndex>

const categoricalDimension = (count: number): Effect.Effect<Phase3CategoricalSchema, AllTrialsFailed> =>
  Match.value(count).pipe(
    Match.when((size) => size <= 0, () =>
      Effect.fail(
        new AllTrialsFailed({
          message: "MIPROv2 Phase 3 requires at least one candidate per dimension",
          trialCount: 0
        })
      )),
    Match.when(1, () => Effect.succeed(SearchSpace.categorical([0]))),
    Match.when(2, () => Effect.succeed(SearchSpace.categorical([0, 1]))),
    Match.when(3, () => Effect.succeed(SearchSpace.categorical([0, 1, 2]))),
    Match.when(4, () => Effect.succeed(SearchSpace.categorical([0, 1, 2, 3]))),
    Match.when(5, () => Effect.succeed(SearchSpace.categorical([0, 1, 2, 3, 4]))),
    Match.when(6, () => Effect.succeed(SearchSpace.categorical([0, 1, 2, 3, 4, 5]))),
    Match.when(7, () => Effect.succeed(SearchSpace.categorical([0, 1, 2, 3, 4, 5, 6]))),
    Match.when(8, () => Effect.succeed(SearchSpace.categorical([0, 1, 2, 3, 4, 5, 6, 7]))),
    Match.when(9, () => Effect.succeed(SearchSpace.categorical([0, 1, 2, 3, 4, 5, 6, 7, 8]))),
    Match.when(10, () => Effect.succeed(SearchSpace.categorical([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]))),
    Match.orElse((size) =>
      Effect.fail(
        new AllTrialsFailed({
          message: `MIPROv2 Phase 3 supports up to 10 categorical candidates per dimension (received ${size})`,
          trialCount: size
        })
      )
    )
  )

/**
 * Extracts a single dimension index from a Phase 3 configuration
 * record.
 *
 * Fails with `AllTrialsFailed` when the requested key is absent —
 * this signals a mismatch between the search space definition and the
 * config the sampler produced.
 *
 * @since 0.0.0
 * @category helpers
 */
export const configIndex = (config: Phase3Config, key: string): Effect.Effect<Phase3DimensionIndex, AllTrialsFailed> =>
  Option.match(Option.fromNullable(config[key]), {
    onNone: () =>
      Effect.fail(
        new AllTrialsFailed({
          message: `Missing phase-3 configuration key '${key}'`,
          trialCount: 0
        })
      ),
    onSome: (value) => Effect.succeed(value)
  })

/**
 * Pairs each predictor in the module with its demo and instruction
 * candidate sets, producing a `PredictorBinding` per predictor.
 *
 * Fails with `AllTrialsFailed` when any predictor lacks a
 * corresponding entry in either candidate array.
 *
 * @since 0.0.0
 * @category constructors
 * @see {@link buildSearchDimensions} — consumes the bindings
 */
export const resolveBindings = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: {
  readonly module: DspModule<I, O>
  readonly demoCandidates: ReadonlyArray<PredictorDemoCandidates>
  readonly instructionCandidates: ReadonlyArray<PredictorInstructionCandidates>
}) =>
  Effect.forEach(collectModuleParamRefs(options.module), (ref) =>
    Effect.gen(function*() {
      const demos = yield* Option.match(
        Arr.findFirst(options.demoCandidates, (entry) => entry.predictorName === ref.name),
        {
          onNone: () =>
            Effect.fail(
              new AllTrialsFailed({
                message: `Missing phase-3 demo candidates for predictor '${ref.name}'`,
                trialCount: 0
              })
            ),
          onSome: (entry) => Effect.succeed(entry)
        }
      )
      const instructions = yield* Option.match(
        Arr.findFirst(options.instructionCandidates, (entry) => entry.predictorName === ref.name),
        {
          onNone: () =>
            Effect.fail(
              new AllTrialsFailed({
                message: `Missing phase-3 instruction candidates for predictor '${ref.name}'`,
                trialCount: 0
              })
            ),
          onSome: (entry) => Effect.succeed(entry)
        }
      )

      return new PredictorBinding({
        predictorName: ref.name,
        paramsRef: ref.params,
        demos,
        instructions
      })
    }))

/**
 * Builds the index-0 baseline configuration — every predictor uses its
 * first demo candidate and first instruction candidate.
 *
 * This config is evaluated on the full validation set before the
 * search loop to produce a `PriorTrial` for warm-starting.
 *
 * @since 0.0.0
 * @category constructors
 */
export const baselineConfig = (bindings: ReadonlyArray<PredictorBinding>): Phase3Config =>
  Arr.reduce(bindings, Record.empty<string, Phase3DimensionIndex>(), (config, binding) =>
    Record.set(
      Record.set(config, demoDimensionName(binding.predictorName), 0),
      instructionDimensionName(binding.predictorName),
      0
    ))

/**
 * Creates the categorical search-space dimensions for `effect-search`.
 *
 * Each predictor contributes two dimensions — one for its demo
 * candidates and one for its instruction candidates — keyed by
 * `<predictorName>__demo` and `<predictorName>__instruction`.
 * Candidate counts are capped at 10; larger sets cause
 * `AllTrialsFailed`.
 *
 * @since 0.0.0
 * @category constructors
 * @see {@link resolveBindings} — produces the input bindings
 */
export const buildSearchDimensions = (bindings: ReadonlyArray<PredictorBinding>) =>
  Effect.reduce(
    bindings,
    Record.empty<string, Phase3CategoricalSchema>(),
    (dimensions, binding) =>
      Effect.gen(function*() {
        const demoDimension = yield* categoricalDimension(binding.demos.candidates.length)
        const instructionDimension = yield* categoricalDimension(binding.instructions.candidates.length)

        return Record.set(
          Record.set(dimensions, demoDimensionName(binding.predictorName), demoDimension),
          instructionDimensionName(binding.predictorName),
          instructionDimension
        )
      })
  )

/**
 * Returns the largest candidate-set size across all bindings for a
 * given extractor (e.g. demo count or instruction count).
 *
 * The result is floored at `1` so callers can safely use it as a
 * divisor.
 *
 * @since 0.0.0
 * @category helpers
 */
export const maxCandidateCount = (
  bindings: ReadonlyArray<PredictorBinding>,
  countOf: (binding: PredictorBinding) => number
): number => Arr.reduce(bindings, 1, (currentMax, binding) => Math.max(currentMax, countOf(binding)))

/**
 * Extracts a scalar score from an objective value.
 *
 * MIPROv2 Phase 3 operates in single-objective mode. This function
 * succeeds when the value is already a number and fails with
 * `AllTrialsFailed` when it receives a multi-objective array.
 *
 * @since 0.0.0
 * @category helpers
 */
export const objectiveScore = (value: number | ReadonlyArray<number>) =>
  Match.value(value).pipe(
    Match.when(Predicate.isNumber, (score) => Effect.succeed(score)),
    Match.orElse(() =>
      Effect.fail(
        new AllTrialsFailed({
          message: "MIPROv2 Phase 3 expected a single-objective projection",
          trialCount: 0
        })
      )
    )
  )

/**
 * Extracts the winning `Phase3Config` from a completed study result.
 *
 * For single-objective results the best trial is returned directly.
 * For multi-objective results the first entry on the Pareto front is
 * used. Fails with `AllTrialsFailed` when the Pareto front is empty.
 *
 * @since 0.0.0
 * @category helpers
 */
export const resolveBestConfig = (
  studyResult: Study.StudyResult<Phase3Config>,
  trialBudget: number
): Effect.Effect<Phase3Config, AllTrialsFailed> =>
  Match.value(studyResult).pipe(
    Match.tag("SingleObjective", ({ bestTrial }) => Effect.succeed(bestTrial.config)),
    Match.tag("MultiObjective", ({ paretoFront }) =>
      Option.match(Arr.head(paretoFront), {
        onNone: () =>
          Effect.fail(
            new AllTrialsFailed({
              message: "MIPROv2 Phase 3 could not resolve best trial from pareto front",
              trialCount: trialBudget
            })
          ),
        onSome: (trial) => Effect.succeed(trial.config)
      })),
    Match.exhaustive
  )
