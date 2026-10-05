/**
 * Evolves module instructions through reflective mutation, common-ancestor
 * merges, and Pareto-weighted parent selection.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.1.0
 * @module
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { nextDeterministicSeed, normalizeDeterministicSeed } from "@scenesystems/effect-search/Sampler"
import {
  Array as Arr,
  Boolean,
  Data,
  Effect,
  Inspectable,
  Match,
  Number as Num,
  Option,
  Ref,
  Schema,
  Stream,
  String
} from "effect"
import type * as AiError from "effect/ai/AiError"
import type * as LanguageModel from "effect/ai/LanguageModel"
import type { DspError } from "./DspError.js"
import { Example } from "./Example.js"
import { deriveParetoKernelSnapshot } from "./internal/gepa/frontier.js"
import { GEPAState, PredictorInstruction, ProgramCandidate } from "./internal/gepa/model.js"
import { candidateParameters, evaluateCandidate } from "./internal/gepa/runtime/evaluate.js"
import { runMergePhase } from "./internal/gepa/runtime/mergePhase.js"
import { runMutationPhase } from "./internal/gepa/runtime/mutation.js"
import { streamGEPAEvents } from "./internal/gepa/runtime/stream.js"
import * as Binding from "./internal/parameterBinding.js"
import type { Metric } from "./Metric.js"
import { bound, type Module as DspModule } from "./Module.js"
import { predictors } from "./ModuleGraph.js"
import * as Optimized from "./Optimized.js"

const normalizeNonNegativeCount = (value: number): number =>
  Match.value(value).pipe(
    Match.when(Numeric.isFinite, (candidate) => Numeric.max(0, Numeric.floor(candidate))),
    Match.orElse(() => 0)
  )

/** Ordered examples consumed by GEPA.
 * @since 0.1.0
 * @category schemas
 */
export const Examples = Schema.Array(Example)
/** Ordered examples consumed by GEPA.
 * @since 0.1.0
 * @category type-level
 */
export type Examples = typeof Examples.Type

/** Configures reflective mutation and Pareto selection.
 * @since 0.1.0
 * @category models
 */
export class Options<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never
> extends Data.Class<{
  readonly module: DspModule<I, O, E, R>
  readonly trainset: Examples
  readonly valset?: Examples
  readonly metric: Metric<ME, MR, Schema.Schema.Type<Schema.Struct<O>>>
  readonly maxIterations: number
  readonly maxMergeInvocations?: number
  readonly seed?: number
}> {}

/** GEPA lifecycle event schema.
 * @since 0.1.0
 * @category events
 */
export const Event = Schema.Union([
  Schema.TaggedStruct("IterationStarted", { iteration: Schema.Finite, frontierSize: Schema.Finite }),
  Schema.TaggedStruct("MergeChecked", {
    iteration: Schema.Finite,
    attempted: Schema.Boolean,
    accepted: Schema.Boolean,
    mergeBudgetRemaining: Schema.Finite
  }),
  Schema.TaggedStruct("MutationProposed", {
    iteration: Schema.Finite,
    parentId: Schema.String,
    mutatedCandidateId: Schema.String,
    predictorName: Schema.String,
    instruction: Schema.String
  }),
  Schema.TaggedStruct("AcceptanceEvaluated", {
    iteration: Schema.Finite,
    accepted: Schema.Boolean,
    gate1Passed: Schema.Boolean,
    fullValsetEvaluated: Schema.Boolean,
    previousSubsampleSum: Schema.Finite,
    mutatedSubsampleSum: Schema.Finite
  }),
  Schema.TaggedStruct("ParetoUpdated", {
    iteration: Schema.Finite,
    frontierIndices: Schema.Array(Schema.Finite),
    dominatedIndices: Schema.Array(Schema.Finite),
    parentWeights: Schema.Array(Schema.Struct({ candidateIndex: Schema.Finite, weight: Schema.Finite }))
  }),
  Schema.TaggedStruct("IterationCompleted", {
    iteration: Schema.Finite,
    acceptedCandidate: Schema.Boolean,
    frontierSize: Schema.Finite
  }),
  Schema.TaggedStruct("OptimizationCompleted", {
    iterations: Schema.Finite,
    bestCandidateId: Schema.String,
    frontierSize: Schema.Finite
  })
])

/** GEPA lifecycle event.
 * @since 0.1.0
 * @category events
 */
export type Event = typeof Event.Type
/** Constructors and matching for GEPA events.
 * @since 0.1.0
 * @category events
 */
export const events = Data.taggedEnum<Event>()
/** Effectful GEPA event observer.
 * @since 0.1.0
 * @category models
 */
export type EventSink<E = never, R = never> = (event: Event) => Effect.Effect<void, E, R>
/** Discards GEPA lifecycle events.
 * @since 0.1.0
 * @category constants
 */
export const noEvents: EventSink = () => Effect.void
/** Default accepted common-ancestor merge budget.
 * @since 0.1.0
 * @category constants
 */
export const defaultMaxMergeInvocations = 5

/** Formatted GEPA progress line.
 * @since 0.1.0
 * @category models
 */
export class ProgressLine extends Schema.Class<ProgressLine>("@scenesystems/effect-dsp/GEPA/ProgressLine")({
  tag: Schema.String,
  details: Schema.String,
  text: Schema.String
}) {}
const render = (label: string, value: unknown): string => String.concat(label, Inspectable.toStringUnknown(value))
const progressDetails = (event: Event): string =>
  Match.value(event).pipe(
    Match.tag("IterationStarted", ({ iteration, frontierSize }) =>
      Arr.join(Arr.make(render("iteration=", iteration), render("frontierSize=", frontierSize)), " ")),
    Match.tag("MergeChecked", ({ iteration, attempted, accepted, mergeBudgetRemaining }) =>
      Arr.join(
        Arr.make(
          render("iteration=", iteration),
          render("attempted=", attempted),
          render("accepted=", accepted),
          render("mergeBudgetRemaining=", mergeBudgetRemaining)
        ),
        " "
      )),
    Match.tag("MutationProposed", ({ iteration, parentId, mutatedCandidateId, predictorName, instruction }) =>
      Arr.join(
        Arr.make(
          render("iteration=", iteration),
          render("parentId=", parentId),
          render("mutatedCandidateId=", mutatedCandidateId),
          render("predictor=", predictorName),
          render("instructionLength=", String.length(instruction))
        ),
        " "
      )),
    Match.tag("AcceptanceEvaluated", ({ iteration, accepted, gate1Passed, fullValsetEvaluated }) =>
      Arr.join(
        Arr.make(
          render("iteration=", iteration),
          render("accepted=", accepted),
          render("gate1Passed=", gate1Passed),
          render("fullValsetEvaluated=", fullValsetEvaluated)
        ),
        " "
      )),
    Match.tag("ParetoUpdated", ({ iteration, frontierIndices, dominatedIndices, parentWeights }) =>
      Arr.join(
        Arr.make(
          render("iteration=", iteration),
          render("frontierCount=", Arr.length(frontierIndices)),
          render("dominatedCount=", Arr.length(dominatedIndices)),
          render("parentWeightCount=", Arr.length(parentWeights))
        ),
        " "
      )),
    Match.tag("IterationCompleted", ({ iteration, acceptedCandidate, frontierSize }) =>
      Arr.join(
        Arr.make(
          render("iteration=", iteration),
          render("acceptedCandidate=", acceptedCandidate),
          render("frontierSize=", frontierSize)
        ),
        " "
      )),
    Match.tag("OptimizationCompleted", ({ iterations, bestCandidateId, frontierSize }) =>
      Arr.join(
        Arr.make(
          render("iterations=", iterations),
          render("bestCandidateId=", bestCandidateId),
          render("frontierSize=", frontierSize)
        ),
        " "
      )),
    Match.exhaustive
  )
/** Formats one GEPA event.
 * @since 0.1.0
 * @category formatters
 */
export const formatEvent = (event: Event): ProgressLine => {
  const details = progressDetails(event)
  return new ProgressLine({ tag: event._tag, details, text: String.concat(String.concat(event._tag, " "), details) })
}
/** Effectful GEPA progress observer.
 * @since 0.1.0
 * @category models
 */
export type ProgressSink<E = never, R = never> = (line: ProgressLine) => Effect.Effect<void, E, R>
/** Observes GEPA progress without changing stream values.
 * @since 0.1.0
 * @category combinators
 */
export const tapProgress =
  <E, R>(sink: ProgressSink<E, R>) =>
  <SE, SR>(stream: Stream.Stream<Event, SE, SR>): Stream.Stream<Event, E | SE, R | SR> =>
    Stream.tap(stream, (event) => sink(formatEvent(event)))

/** Folded terminal GEPA event state.
 * @since 0.1.0
 * @category models
 */
export class Report extends Schema.Class<Report>("@scenesystems/effect-dsp/GEPA/Report")({
  totalEvents: Schema.Finite,
  iterationStartedCount: Schema.Finite,
  mergeCheckedCount: Schema.Finite,
  mutationProposedCount: Schema.Finite,
  acceptanceEvaluatedCount: Schema.Finite,
  acceptanceAcceptedCount: Schema.Finite,
  gate1PassedCount: Schema.Finite,
  fullValsetEvaluatedCount: Schema.Finite,
  paretoUpdatedCount: Schema.Finite,
  iterationCompletedCount: Schema.Finite,
  iterationWithAcceptedCandidateCount: Schema.Finite,
  optimizationCompletedSeen: Schema.Boolean,
  optimizationIterationCount: Schema.Finite,
  optimizationBestCandidateIdSeen: Schema.Boolean,
  optimizationBestCandidateId: Schema.String,
  optimizationFrontierSize: Schema.Finite,
  lastReportedFrontierSize: Schema.Finite,
  maxFrontierSize: Schema.Finite,
  parentWeightEntriesObserved: Schema.Finite
}) {}
const emptySummary = new Report({
  totalEvents: 0,
  iterationStartedCount: 0,
  mergeCheckedCount: 0,
  mutationProposedCount: 0,
  acceptanceEvaluatedCount: 0,
  acceptanceAcceptedCount: 0,
  gate1PassedCount: 0,
  fullValsetEvaluatedCount: 0,
  paretoUpdatedCount: 0,
  iterationCompletedCount: 0,
  iterationWithAcceptedCandidateCount: 0,
  optimizationCompletedSeen: false,
  optimizationIterationCount: 0,
  optimizationBestCandidateIdSeen: false,
  optimizationBestCandidateId: "",
  optimizationFrontierSize: 0,
  lastReportedFrontierSize: 0,
  maxFrontierSize: 0,
  parentWeightEntriesObserved: 0
})
/** Summarizes GEPA lifecycle events.
 * @since 0.1.0
 * @category combinators
 */
export const summarizeEvents = (input: Iterable<Event>): Report =>
  Arr.reduce(input, emptySummary, (summary, event) => {
    const fields = Match.value(event).pipe(
      Match.tagsExhaustive({
        IterationStarted: ({ frontierSize }) => ({
          iterationStartedCount: Num.increment(summary.iterationStartedCount),
          lastReportedFrontierSize: frontierSize,
          maxFrontierSize: Num.max(summary.maxFrontierSize, frontierSize)
        }),
        MergeChecked: () => ({ mergeCheckedCount: Num.increment(summary.mergeCheckedCount) }),
        MutationProposed: () => ({ mutationProposedCount: Num.increment(summary.mutationProposedCount) }),
        AcceptanceEvaluated: ({ accepted, gate1Passed, fullValsetEvaluated }) => ({
          acceptanceEvaluatedCount: Num.increment(summary.acceptanceEvaluatedCount),
          acceptanceAcceptedCount: Num.sum(
            summary.acceptanceAcceptedCount,
            Boolean.match(accepted, { onFalse: () => 0, onTrue: () => 1 })
          ),
          gate1PassedCount: Num.sum(
            summary.gate1PassedCount,
            Boolean.match(gate1Passed, { onFalse: () => 0, onTrue: () => 1 })
          ),
          fullValsetEvaluatedCount: Num.sum(
            summary.fullValsetEvaluatedCount,
            Boolean.match(fullValsetEvaluated, { onFalse: () => 0, onTrue: () => 1 })
          )
        }),
        ParetoUpdated: ({ frontierIndices, parentWeights }) => ({
          paretoUpdatedCount: Num.increment(summary.paretoUpdatedCount),
          lastReportedFrontierSize: Arr.length(frontierIndices),
          maxFrontierSize: Num.max(summary.maxFrontierSize, Arr.length(frontierIndices)),
          parentWeightEntriesObserved: Num.sum(summary.parentWeightEntriesObserved, Arr.length(parentWeights))
        }),
        IterationCompleted: ({ acceptedCandidate, frontierSize }) => ({
          iterationCompletedCount: Num.increment(summary.iterationCompletedCount),
          iterationWithAcceptedCandidateCount: Num.sum(
            summary.iterationWithAcceptedCandidateCount,
            Boolean.match(acceptedCandidate, { onFalse: () => 0, onTrue: () => 1 })
          ),
          lastReportedFrontierSize: frontierSize,
          maxFrontierSize: Num.max(summary.maxFrontierSize, frontierSize)
        }),
        OptimizationCompleted: ({ iterations, bestCandidateId, frontierSize }) => ({
          optimizationCompletedSeen: true,
          optimizationIterationCount: iterations,
          optimizationBestCandidateIdSeen: true,
          optimizationBestCandidateId: bestCandidateId,
          optimizationFrontierSize: frontierSize,
          lastReportedFrontierSize: frontierSize,
          maxFrontierSize: Num.max(summary.maxFrontierSize, frontierSize)
        })
      })
    )
    return new Report({
      ...Schema.encodeSync(Report)(summary),
      totalEvents: Num.increment(summary.totalEvents),
      ...fields
    })
  })

/**
 * Evolves a module's instruction and emits each lifecycle event in execution order.
 *
 * @remarks
 * The initial program is evaluated before the first event. Each sink effect
 * completes before the next optimizer step. An iteration may attempt a merge,
 * then proposes one mutation, evaluates acceptance, updates the Pareto
 * frontier, and emits `IterationCompleted`.
 *
 * Mutation-proposal language-model failures remain checked failures; no
 * replacement instruction is invented. Module, metric, and Schema failures
 * remain in the Effect error channel, including candidate decoding failures.
 * Candidate instructions are applied through scoped overlays. At completion,
 * unfrozen leaf instructions from the first index in the final Pareto frontier
 * are returned in a bound program with parameters and a serializable report.
 * Caller refs remain unchanged. GEPA does not reduce the final frontier to a
 * scalar score ranking.
 *
 * @typeParam I - Input fields accepted by the optimized module.
 * @typeParam O - Output fields scored during candidate evaluation.
 * @typeParam ME - Expected failure from the configured metric.
 * @typeParam MR - Services required by the configured metric.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al. (2025)}
 * @since 0.1.0
 * @category constructors
 */
export const runWithEvents = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never,
  EE = never,
  ER = never
>(
  options: Options<I, O, ME, MR, E, R>,
  observe: EventSink<EE, ER>
) =>
  Effect.gen(function*() {
    const recorded = yield* Ref.make(Arr.empty<Event>())
    const emit: EventSink<EE, ER> = (event) =>
      Ref.update(recorded, Arr.append(event)).pipe(Effect.andThen(observe(event)))
    const paramRefs = Arr.filter(Arr.fromIterable(predictors(options.module)), (owner) => owner.ownership !== "frozen")
    const initialInstructions = yield* Effect.forEach(paramRefs, (owner) =>
      Binding.read(owner.params, owner.id).pipe(
        Effect.map((params) =>
          new PredictorInstruction({ predictorName: owner.name, instruction: params.instructions })
        )
      )).pipe(Binding.withOwners(predictors(options.module)))
    const initialCandidate = new ProgramCandidate({
      candidateId: "candidate-0",
      parentIds: Arr.empty<string>(),
      predictorInstructions: initialInstructions
    })
    const initialEvaluation = yield* evaluateCandidate(options, initialCandidate)
    const initialSnapshot = deriveParetoKernelSnapshot(Arr.make(initialEvaluation.scores))
    const stateRef = yield* Ref.make(
      new GEPAState({
        iteration: 0,
        candidates: Arr.make(initialCandidate),
        scoreVectors: Arr.make(initialEvaluation.scores),
        paretoSnapshot: initialSnapshot,
        mergeBudgetRemaining: normalizeNonNegativeCount(
          Option.getOrElse(
            Option.fromUndefinedOr(options.maxMergeInvocations),
            () => defaultMaxMergeInvocations
          )
        ),
        lastIterationFoundNew: false,
        seed: normalizeDeterministicSeed(Option.getOrElse(Option.fromUndefinedOr(options.seed), () => 1))
      })
    )

    const runIteration = (iteration: number): Effect.Effect<
      void,
      E | ME | EE | AiError.AiError | DspError | Schema.SchemaError,
      | R
      | MR
      | ER
      | LanguageModel.LanguageModel
      | Schema.Struct.DecodingServices<I>
      | Schema.Struct.EncodingServices<I>
      | Schema.Struct.DecodingServices<O>
      | Schema.Struct.EncodingServices<O>
    > =>
      Effect.suspend(() =>
        Boolean.match(
          Num.isLessThanOrEqualTo(iteration, normalizeNonNegativeCount(options.maxIterations)),
          {
            onFalse: () => Effect.void,
            onTrue: () =>
              Effect.gen(function*() {
                const state = yield* Ref.get(stateRef)
                const mergeSeed = state.seed
                const mutationSeed = nextDeterministicSeed(mergeSeed)

                yield* emit(
                  events.IterationStarted({ iteration, frontierSize: Arr.length(state.paretoSnapshot.frontierIndices) })
                )

                const stateAfterMerge = yield* runMergePhase(options, state, iteration, mergeSeed, emit)
                const mutationResult = yield* runMutationPhase(
                  options,
                  stateAfterMerge,
                  iteration,
                  mutationSeed,
                  initialCandidate,
                  emit
                )
                const updatedSnapshot = deriveParetoKernelSnapshot(mutationResult.stateAfterAcceptance.scoreVectors)
                const nextState = new GEPAState({
                  iteration,
                  candidates: mutationResult.stateAfterAcceptance.candidates,
                  scoreVectors: mutationResult.stateAfterAcceptance.scoreVectors,
                  paretoSnapshot: updatedSnapshot,
                  mergeBudgetRemaining: mutationResult.stateAfterAcceptance.mergeBudgetRemaining,
                  lastIterationFoundNew: mutationResult.stateAfterAcceptance.lastIterationFoundNew,
                  seed: nextDeterministicSeed(mutationSeed)
                })

                yield* Ref.set(stateRef, nextState)
                yield* emit(
                  events.ParetoUpdated({
                    iteration,
                    frontierIndices: updatedSnapshot.frontierIndices,
                    dominatedIndices: updatedSnapshot.dominatedIndices,
                    parentWeights: updatedSnapshot.parentWeights
                  })
                )
                yield* emit(
                  events.IterationCompleted({
                    iteration,
                    acceptedCandidate: mutationResult.accepted,
                    frontierSize: Arr.length(updatedSnapshot.frontierIndices)
                  })
                )
              }).pipe(Effect.flatMap(() => runIteration(Num.increment(iteration))))
          }
        )
      )
    yield* runIteration(1)

    const finalState = yield* Ref.get(stateRef)
    const bestIndex = Option.getOrElse(Arr.head(finalState.paretoSnapshot.frontierIndices), () => 0)
    const bestCandidate = Option.getOrElse(Arr.get(finalState.candidates, bestIndex), () => initialCandidate)
    const parameters = yield* candidateParameters(options.module, bestCandidate)

    yield* emit(
      events.OptimizationCompleted({
        iterations: finalState.iteration,
        bestCandidateId: bestCandidate.candidateId,
        frontierSize: Arr.length(finalState.paretoSnapshot.frontierIndices)
      })
    )

    return new Optimized.Result({
      program: bound(options.module, parameters),
      parameters,
      report: summarizeEvents(yield* Ref.get(recorded))
    })
  })

/**
 * Evolves a module while discarding lifecycle events.
 *
 * @returns The supplied module after its owned instructions are replaced by
 * the first candidate in the final Pareto frontier.
 *
 * @typeParam I - Input fields accepted by the optimized module.
 * @typeParam O - Output fields scored during candidate evaluation.
 * @typeParam ME - Expected failure from the configured metric.
 * @typeParam MR - Services required by the configured metric.
 *
 * @since 0.1.0
 * @category constructors
 */
export const run = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never
>(
  options: Options<I, O, ME, MR, E, R>
) => runWithEvents(options, noEvents)

/**
 * Emits GEPA lifecycle events while stream consumption drives optimization.
 *
 * @remarks
 * The stream completes after `OptimizationCompleted` and contains events only.
 * Use `runWithEvents` to retain the bound result. Module and metric failures
 * fail the stream; caller parameters remain unchanged.
 *
 * @typeParam I - Input fields accepted by the optimized module.
 * @typeParam O - Output fields scored during candidate evaluation.
 * @typeParam ME - Expected failure from the configured metric.
 * @typeParam MR - Services required by the configured metric.
 *
 * @since 0.1.0
 * @category constructors
 */
export const stream = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never
>(
  options: Options<I, O, ME, MR, E, R>
) => streamGEPAEvents((emit) => runWithEvents(options, emit))
