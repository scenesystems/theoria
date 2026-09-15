/**
 * Phase 3 search space construction — maps instruction×demo candidates into
 * effect-search dimensions.
 *
 * @since 0.1.0
 * @internal
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import type { Study } from "@scenesystems/effect-search"
import { SearchSpace } from "@scenesystems/effect-search"
import {
  Array as Arr,
  Data,
  Effect,
  HashMap,
  Inspectable,
  Match,
  Number as Num,
  Option,
  Predicate,
  Record,
  String as Str
} from "effect"
import type { Schema } from "effect"
import type { ObjectiveValue } from "../../../contracts/ObjectiveProjection.js"
import { AllTrialsFailed } from "../../../Errors/optimizer.js"
import { collectModuleParamRefs, type ModuleParamRef } from "../../../internal/module-params.js"
import type { Module as DspModule } from "../../../Module/model.js"
import type { PredictorDemoCandidates, PredictorDemoCandidateSets } from "../bootstrap.js"
import type { PredictorInstructionCandidates, PredictorInstructionCandidateSets } from "../propose.js"
import {
  demoDimensionName,
  instructionDimensionName,
  type Phase3Config,
  Phase3DimensionIndex,
  PredictorBinding
} from "./model.js"

type Phase3CategoricalSchema = Schema.Schema<Phase3DimensionIndex>

/** @internal */
export class ResolveBindingsOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E,
  R
> extends Data.Class<{
  readonly module: DspModule<I, O, E, R>
  readonly demoCandidates: PredictorDemoCandidateSets
  readonly instructionCandidates: PredictorInstructionCandidateSets
}> {}

const categoricalDimension = (count: number): Effect.Effect<Phase3CategoricalSchema, AllTrialsFailed> =>
  Match.value(count).pipe(
    Match.when((size) => Num.lessThanOrEqualTo(size, 0), () =>
      Effect.fail(
        new AllTrialsFailed({
          message: "MIPROv2 Phase 3 requires at least one candidate per dimension",
          trialCount: 0
        })
      )),
    Match.when(
      (size) => Num.lessThanOrEqualTo(size, Arr.length(Phase3DimensionIndex.literals)),
      (size) =>
        Arr.match(Arr.take(Phase3DimensionIndex.literals, size), {
          onEmpty: () =>
            Effect.fail(
              new AllTrialsFailed({
                message: "MIPROv2 Phase 3 requires at least one candidate per dimension",
                trialCount: 0
              })
            ),
          onNonEmpty: (choices) => Effect.succeed(SearchSpace.categorical(choices))
        })
    ),
    Match.orElse((size) =>
      Effect.fail(
        new AllTrialsFailed({
          message: Str.concat(
            "MIPROv2 Phase 3 supports up to 10 categorical candidates per dimension (received ",
            Str.concat(Inspectable.toStringUnknown(size), ")")
          ),
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
 * @since 0.1.0
 * @category helpers
 */
export const configIndex = (config: Phase3Config, key: string): Effect.Effect<Phase3DimensionIndex, AllTrialsFailed> =>
  Option.match(Record.get(config, key), {
    onNone: () =>
      Effect.fail(
        new AllTrialsFailed({
          message: Str.concat(Str.concat("Missing phase-3 configuration key '", key), "'"),
          trialCount: 0
        })
      ),
    onSome: (value) => Effect.succeed(value)
  })

const bindingFailure = (message: string): AllTrialsFailed =>
  new AllTrialsFailed({
    message,
    trialCount: 0
  })

const indexDemoCandidateSets = (candidateSets: PredictorDemoCandidateSets) =>
  Effect.reduce(
    candidateSets,
    HashMap.empty<string, PredictorDemoCandidates>(),
    (setsByName, candidateSet) =>
      Effect.if(HashMap.has(setsByName, candidateSet.predictorName), {
        onTrue: () =>
          Effect.fail(
            bindingFailure(
              Str.concat(
                Str.concat("Ambiguous phase-3 demo candidates for predictor '", candidateSet.predictorName),
                "'"
              )
            )
          ),
        onFalse: () => Effect.succeed(HashMap.set(setsByName, candidateSet.predictorName, candidateSet))
      })
  )

const indexInstructionCandidateSets = (candidateSets: PredictorInstructionCandidateSets) =>
  Effect.reduce(
    candidateSets,
    HashMap.empty<string, PredictorInstructionCandidates>(),
    (setsByName, candidateSet) =>
      Effect.if(HashMap.has(setsByName, candidateSet.predictorName), {
        onTrue: () =>
          Effect.fail(
            bindingFailure(
              Str.concat(
                Str.concat("Ambiguous phase-3 instruction candidates for predictor '", candidateSet.predictorName),
                "'"
              )
            )
          ),
        onFalse: () => Effect.succeed(HashMap.set(setsByName, candidateSet.predictorName, candidateSet))
      })
  )

const requireDestination = (
  refsByName: HashMap.HashMap<string, ModuleParamRef>,
  predictorName: string,
  candidateKind: string
) =>
  Option.match(HashMap.get(refsByName, predictorName), {
    onNone: () =>
      Effect.fail(
        bindingFailure(
          Str.concat(
            Str.concat(
              Str.concat("Unknown phase-3 ", candidateKind),
              Str.concat(" candidates for predictor '", predictorName)
            ),
            "'"
          )
        )
      ),
    onSome: Effect.succeed
  })

const validateCandidateIdentity = (
  candidateKind: string,
  setPredictorName: string,
  candidatePredictorName: string
) =>
  Effect.if(Str.Equivalence(candidatePredictorName, setPredictorName), {
    onTrue: () => Effect.void,
    onFalse: () =>
      Effect.fail(
        bindingFailure(
          Arr.join(
            Arr.make(
              "Phase-3 ",
              candidateKind,
              " candidate for predictor '",
              setPredictorName,
              "' identifies predictor '",
              candidatePredictorName,
              "'"
            ),
            ""
          )
        )
      )
  })

const validateDemoCandidateSet = (
  refsByName: HashMap.HashMap<string, ModuleParamRef>,
  candidateSet: PredictorDemoCandidates
) =>
  Effect.gen(function*() {
    const destination = yield* requireDestination(refsByName, candidateSet.predictorName, "demo")
    yield* Effect.forEach(
      candidateSet.candidates,
      (candidate) =>
        validateCandidateIdentity("demo", candidateSet.predictorName, candidate.predictorName).pipe(
          Effect.zipRight(
            Effect.forEach(candidate.params.demos, destination.demoContract.decode, { discard: true }).pipe(
              Effect.mapError(() =>
                bindingFailure(
                  Str.concat(
                    Str.concat(
                      "Phase-3 demo candidate does not match the destination contract for predictor '",
                      candidateSet.predictorName
                    ),
                    "'"
                  )
                )
              )
            )
          )
        ),
      { discard: true }
    )
  })

const validateInstructionCandidateSet = (
  refsByName: HashMap.HashMap<string, ModuleParamRef>,
  candidateSet: PredictorInstructionCandidates
) =>
  requireDestination(refsByName, candidateSet.predictorName, "instruction").pipe(
    Effect.zipRight(
      Effect.forEach(
        candidateSet.candidates,
        (candidate) => validateCandidateIdentity("instruction", candidateSet.predictorName, candidate.predictorName),
        { discard: true }
      )
    )
  )

/**
 * Pairs each predictor in the module with its demo and instruction
 * candidate sets, producing a `PredictorBinding` per predictor.
 *
 * Before producing bindings, every supplied set is matched uniquely to a real
 * destination. Unknown or duplicate sets and mismatched candidate identities
 * fail with `AllTrialsFailed`. Every demonstration in every candidate is
 * validated through the destination's wire-level demo contract. Validation
 * completes before Phase 3 can write any parameter ref.
 *
 * @since 0.1.0
 * @category constructors
 * @see {@link buildSearchDimensions} — consumes the bindings
 */
export const resolveBindings = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E,
  R
>(options: ResolveBindingsOptions<I, O, E, R>) =>
  Effect.gen(function*() {
    const refs = collectModuleParamRefs(options.module)
    const refsByName = Arr.reduce(
      refs,
      HashMap.empty<string, ModuleParamRef>(),
      (byName, ref) => HashMap.set(byName, ref.name, ref)
    )
    const demosByName = yield* indexDemoCandidateSets(options.demoCandidates)
    const instructionsByName = yield* indexInstructionCandidateSets(options.instructionCandidates)

    yield* Effect.forEach(
      options.demoCandidates,
      (candidateSet) => validateDemoCandidateSet(refsByName, candidateSet),
      { discard: true }
    )
    yield* Effect.forEach(
      options.instructionCandidates,
      (candidateSet) => validateInstructionCandidateSet(refsByName, candidateSet),
      { discard: true }
    )

    return yield* Effect.forEach(refs, (ref) =>
      Effect.gen(function*() {
        const demos = yield* Option.match(HashMap.get(demosByName, ref.name), {
          onNone: () =>
            Effect.fail(
              new AllTrialsFailed({
                message: Str.concat(Str.concat("Missing phase-3 demo candidates for predictor '", ref.name), "'"),
                trialCount: 0
              })
            ),
          onSome: (entry) => Effect.succeed(entry)
        })
        const instructions = yield* Option.match(HashMap.get(instructionsByName, ref.name), {
          onNone: () =>
            Effect.fail(
              new AllTrialsFailed({
                message: Str.concat(
                  Str.concat("Missing phase-3 instruction candidates for predictor '", ref.name),
                  "'"
                ),
                trialCount: 0
              })
            ),
          onSome: (entry) => Effect.succeed(entry)
        })

        return new PredictorBinding({
          predictorName: ref.name,
          paramsRef: ref.params,
          demos,
          instructions
        })
      }))
  })

/**
 * Builds the index-0 baseline configuration — every predictor uses its
 * first demo candidate and first instruction candidate.
 *
 * This config is evaluated on the full validation set before the
 * search loop to produce a `PriorTrial` for warm-starting.
 *
 * @since 0.1.0
 * @category constructors
 */
export const baselineConfig = (bindings: Iterable<PredictorBinding>): Phase3Config =>
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
 * @since 0.1.0
 * @category constructors
 * @see {@link resolveBindings} — produces the input bindings
 */
export const buildSearchDimensions = (bindings: Iterable<PredictorBinding>) =>
  Effect.reduce(
    bindings,
    Record.empty<string, Phase3CategoricalSchema>(),
    (dimensions, binding) =>
      Effect.gen(function*() {
        const demoDimension = yield* categoricalDimension(Arr.length(binding.demos.candidates))
        const instructionDimension = yield* categoricalDimension(Arr.length(binding.instructions.candidates))

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
 * @since 0.1.0
 * @category helpers
 */
export const maxCandidateCount = (
  bindings: Iterable<PredictorBinding>,
  countOf: (binding: PredictorBinding) => number
): number => Arr.reduce(bindings, 1, (currentMax, binding) => Numeric.max(currentMax, countOf(binding)))

/**
 * Extracts a scalar score from an objective value.
 *
 * MIPROv2 Phase 3 operates in single-objective mode. Scalar values succeed;
 * multi-objective arrays fail with `AllTrialsFailed`.
 *
 * @since 0.1.0
 * @category helpers
 */
export const objectiveScore = (value: ObjectiveValue) =>
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
 * @since 0.1.0
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
