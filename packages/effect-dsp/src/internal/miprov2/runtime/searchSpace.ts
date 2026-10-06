/**
 * Phase 3 search space construction — maps instruction×demo candidates into
 * effect-search dimensions.
 *
 * @since 0.1.0
 * @internal
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { SearchSpace } from "@scenesystems/effect-search"
import {
  Array as Arr,
  Boolean as Bool,
  Data,
  Effect,
  HashMap,
  Match,
  Number as Num,
  Option,
  Predicate,
  Record,
  Ref,
  String as Str
} from "effect"
import type { Schema } from "effect"
import { AllTrialsFailed } from "../../../DspError.js"
import type { ObjectiveValue } from "../../../EvaluationObjective.js"
import type {
  PredictorDemoCandidates,
  PredictorDemoCandidateSets,
  PredictorInstructionCandidates,
  PredictorInstructionCandidateSets
} from "../../../MIPROv2Candidates.js"
import type { Module as DspModule } from "../../../Module.js"
import { predictors } from "../../../ModuleGraph.js"
import type * as Predictor from "../../../Predictor.js"
import type { Phase3DimensionIndex } from "./model.js"
import { demoDimensionName, instructionDimensionName, type Phase3Config, PredictorBinding } from "./model.js"

type Phase3CategoricalSchema = Schema.Codec<Phase3DimensionIndex, Phase3DimensionIndex, never, never>

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
  Effect.succeed(count).pipe(
    Effect.filterOrFail(Num.isGreaterThan(0), () =>
      new AllTrialsFailed({
        message: "MIPROv2 Phase 3 requires at least one candidate per dimension",
        trialCount: 0
      })),
    Effect.map((size) => SearchSpace.categorical(Arr.makeBy(size, (index) => index)))
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
  Effect.fromOption(Record.get(config, key), () =>
    new AllTrialsFailed({
      message: Str.concat(Str.concat("Missing phase-3 configuration key '", key), "'"),
      trialCount: 0
    }))

const bindingFailure = (message: string): AllTrialsFailed =>
  new AllTrialsFailed({
    message,
    trialCount: 0
  })

const indexDemoCandidateSets = (candidateSets: PredictorDemoCandidateSets) =>
  Effect.reduce(
    candidateSets,
    () => HashMap.empty<string, PredictorDemoCandidates>(),
    (setsByName, candidateSet) =>
      Bool.match(HashMap.has(setsByName, candidateSet.predictorName), {
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
    () => HashMap.empty<string, PredictorInstructionCandidates>(),
    (setsByName, candidateSet) =>
      Bool.match(HashMap.has(setsByName, candidateSet.predictorName), {
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
  refsByName: HashMap.HashMap<string, Predictor.Predictor>,
  predictorName: string,
  candidateKind: string
) =>
  Effect.fromOption(HashMap.get(refsByName, predictorName), () =>
    bindingFailure(
      Str.concat(
        Str.concat(
          Str.concat("Unknown phase-3 ", candidateKind),
          Str.concat(" candidates for predictor '", predictorName)
        ),
        "'"
      )
    ))

const validateCandidateIdentity = (
  candidateKind: string,
  setPredictorName: string,
  candidatePredictorName: string
) =>
  Bool.match(Str.Equivalence(candidatePredictorName, setPredictorName), {
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
  refsByName: HashMap.HashMap<string, Predictor.Predictor>,
  candidateSet: PredictorDemoCandidates
) =>
  Effect.gen(function*() {
    const destination = yield* requireDestination(refsByName, candidateSet.predictorName, "demo")
    yield* Effect.forEach(
      candidateSet.candidates,
      (candidate) =>
        validateCandidateIdentity("demo", candidateSet.predictorName, candidate.predictorName).pipe(
          Effect.andThen(
            Effect.forEach(candidate.parameters.demos, destination.demonstrationCodec.decode, { discard: true }).pipe(
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
  refsByName: HashMap.HashMap<string, Predictor.Predictor>,
  candidateSet: PredictorInstructionCandidates
) =>
  requireDestination(refsByName, candidateSet.predictorName, "instruction").pipe(
    Effect.andThen(
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
 * completes before Phase 3 evaluates any candidate overlay.
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
    const refs = Arr.filter(Arr.fromIterable(predictors(options.module)), (entry) => !entry.frozen)
    const refsByName = Arr.reduce(
      refs,
      HashMap.empty<string, Predictor.Predictor>(),
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

    return yield* Effect.forEach(refs, (ref, index) =>
      Effect.gen(function*() {
        const demos = HashMap.get(demosByName, ref.name)
        yield* Effect.fail(
          new AllTrialsFailed({
            message: `Missing phase-3 demo candidates for predictor '${ref.name}'`,
            trialCount: 0
          })
        ).pipe(Effect.when(Effect.succeed(
          Bool.and(Arr.isReadonlyArrayNonEmpty(options.demoCandidates), Option.isNone(demos))
        )))
        const instructions = yield* Effect.fromOption(HashMap.get(instructionsByName, ref.name), () =>
          new AllTrialsFailed({
            message: Str.concat(
              Str.concat("Missing phase-3 instruction candidates for predictor '", ref.name),
              "'"
            ),
            trialCount: 0
          }))

        return new PredictorBinding({
          index,
          predictorName: ref.name,
          predictorId: ref.path,
          originalParameters: yield* Option.match(ref.boundParameters, {
            onNone: () => Ref.get(ref.parameters),
            onSome: Effect.succeed
          }),
          demos,
          instructions
        })
      }))
  })

/**
 * Builds the index-0 baseline configuration — every predictor uses its
 * first demo candidate and first instruction candidate.
 *
 * The unchanged program's full score is recorded at trial zero using these indexes.
 *
 * @since 0.1.0
 * @category constructors
 */
export const baselineConfig = (bindings: Iterable<PredictorBinding>): Phase3Config =>
  Arr.reduce(bindings, Record.empty<string, Phase3DimensionIndex>(), (config, binding) => ({
    ...config,
    [instructionDimensionName(binding.index)]: 0,
    ...Option.match(binding.demos, {
      onNone: () => ({}),
      onSome: () => ({ [demoDimensionName(binding.index)]: 0 })
    })
  }))

/**
 * Creates the categorical search-space dimensions for `effect-search`.
 *
 * In predictor order, instructions precede demos. Empty demo catalogs omit
 * demonstration dimensions entirely; singletons consume no sampler randomness.
 *
 * @since 0.1.0
 * @category constructors
 * @see {@link resolveBindings} — produces the input bindings
 */
export const buildSearchDimensions = (bindings: Iterable<PredictorBinding>) =>
  Effect.reduce(
    bindings,
    () => Record.empty<string, Phase3CategoricalSchema>(),
    (dimensions, binding) =>
      Effect.gen(function*() {
        const instructionDimension = yield* categoricalDimension(Arr.length(binding.instructions.candidates))
        const instructions = Record.set(dimensions, instructionDimensionName(binding.index), instructionDimension)
        return yield* Option.match(binding.demos, {
          onNone: () => Effect.succeed(instructions),
          onSome: (demos) =>
            categoricalDimension(demos.candidates.length).pipe(
              Effect.map((dimension) => Record.set(instructions, demoDimensionName(binding.index), dimension))
            )
        })
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
