/**
 * Evolves module instructions through reflective mutation, common-ancestor
 * merges, and Pareto-weighted parent selection.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.1.0
 * @module
 */
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import type { ModelSettings } from "@scenesystems/effect-lm/ModelSettings"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as PseudoRandom from "@scenesystems/effect-math/PseudoRandom"
import type { Chunk, Record } from "effect"
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
  String,
  Struct
} from "effect"
import { GEPAError } from "./DspError.js"
import { Example, id as exampleId } from "./Example.js"
import { deriveParetoKernelSnapshot } from "./internal/gepa/frontier.js"
import {
  CandidateScoreMatrix,
  ParetoKernelSnapshot,
  PredictorInstruction,
  ProgramCandidate,
  ProgramCandidates,
  type ReflectiveExample
} from "./internal/gepa/model.js"
import { candidateParameters, evaluateCandidate } from "./internal/gepa/runtime/evaluate.js"
import { runMergePhase } from "./internal/gepa/runtime/mergePhase.js"
import { bestIndex, runMutationPhase } from "./internal/gepa/runtime/mutation.js"
import { streamGEPAEvents } from "./internal/gepa/runtime/stream.js"
import { BatchState } from "./internal/gepa/sampling.js"
import * as Binding from "./internal/parameterBinding.js"
import type { Metric } from "./Metric.js"
import { bound, type Module as DspModule } from "./Module.js"
import { predictors } from "./ModuleGraph.js"
import * as Optimized from "./Optimized.js"
import type * as Predictor from "./Predictor.js"

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

/** Complete continuation state, including both RNG streams and the epoch/merge schedulers.
 * Resume is uninterrupted-equivalent, unlike upstream's partial run_dir checkpoint.
 * @since 0.7.0
 * @category models
 */
export class State extends Schema.Class<State>("@scenesystems/effect-dsp/GEPA/State")({
  iteration: Schema.Int,
  candidates: ProgramCandidates,
  scoreVectors: CandidateScoreMatrix,
  paretoSnapshot: ParetoKernelSnapshot,
  componentCursors: Schema.Array(Schema.Int),
  metricCalls: Schema.Int,
  feedbackMetricCalls: Schema.Int,
  orchestrationRandom: Schema.toCodecJson(PseudoRandom.State),
  adapterRandom: Schema.toCodecJson(PseudoRandom.State),
  batch: BatchState,
  mergesDue: Schema.Int,
  acceptedMerges: Schema.Int,
  lastIterationFoundNew: Schema.Boolean,
  mergeTriplets: Schema.Array(Schema.Tuple([Schema.Int, Schema.Int, Schema.Int])),
  mergeDescriptions: Schema.Array(Schema.Tuple([Schema.Int, Schema.Int, Schema.Array(Schema.Int)]))
}) {}

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
  /** Application guard; default false allows upstream's trainset-as-valset fallback. */
  readonly requireDistinctValset?: boolean
  readonly metric: Metric<ME, MR>
  /** Exactly one budget is required; absent auto is not an implicit budget. */
  readonly auto?: Option.Option<"light" | "medium" | "heavy">
  readonly maxMetricCalls?: number
  readonly maxFullEvals?: number
  /** Optional local iteration boundary for checkpointing, independent of the metric budget. */
  readonly maxIterations?: number
  readonly reflectionMinibatchSize?: number
  readonly candidateSelectionStrategy?: "pareto" | "currentBest"
  readonly skipPerfectScore?: boolean
  readonly addFormatFailureAsFeedback?: boolean
  readonly reflectionSettings?: ModelSettings
  readonly componentSelector?: "roundRobin" | "all" | ((state: State) => Chunk.Chunk<Predictor.Path>)
  readonly instructionProposer?: (
    candidate: ProgramCandidate,
    components: Chunk.Chunk<Predictor.Path>,
    examples: Record.ReadonlyRecord<string, ReadonlyArray<ReflectiveExample>>
  ) => Effect.Effect<Record.ReadonlyRecord<string, string>, ME, MR>
  readonly useMerge?: boolean
  readonly maxMergeInvocations?: number
  readonly numThreads?: number
  readonly failureScore?: number
  readonly perfectScore?: number
  readonly seed?: number
}> {}

/** GEPA lifecycle event schema.
 * @since 0.1.0
 * @category events
 */
export const Event = Schema.Union([
  Schema.TaggedStruct("Checkpoint", { state: State }),
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
    Match.tag("Checkpoint", ({ state }) =>
      `iteration=${state.iteration} metricCalls=${state.metricCalls} feedbackMetricCalls=${state.feedbackMetricCalls}`),
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
  parentWeightEntriesObserved: Schema.Finite,
  metricCalls: Schema.Int,
  feedbackMetricCalls: Schema.Int,
  state: Schema.toCodecJson(Schema.Option(State))
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
  parentWeightEntriesObserved: 0,
  metricCalls: 0,
  feedbackMetricCalls: 0,
  state: Option.none()
})
/** Summarizes GEPA lifecycle events.
 * @since 0.1.0
 * @category combinators
 */
export const summarizeEvents = (input: Iterable<Event>): Report =>
  Arr.reduce(input, emptySummary, (summary, event) => {
    const fields = Match.value(event).pipe(
      Match.tagsExhaustive({
        Checkpoint: ({ state }) => ({
          state: Option.some(state),
          metricCalls: state.metricCalls,
          feedbackMetricCalls: state.feedbackMetricCalls
        }),
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
    return new Report(Struct.assign(summary, {
      totalEvents: Num.increment(summary.totalEvents),
      ...fields
    }))
  })

/**
 * Evolves a module's instruction and emits each lifecycle event in execution order.
 *
 * @remarks
 * The initial program is evaluated before the first event. Each sink effect
 * completes before the next optimizer step. Each iteration evaluates a concrete
 * merge or a reflective mutation, updates the coverage front, and emits
 * `IterationCompleted`. A rejected concrete merge also skips reflection.
 *
 * Rollout failures receive failureScore. Feedback and proposal failures remain
 * typed failures. Metric budgets count evaluated examples, not feedback calls,
 * and stop only at iteration boundaries. The highest aggregate validation score
 * wins, with the earliest candidate retained on ties. Instructions are scoped
 * overlays; caller refs remain unchanged. Checkpoints include both RNG streams.
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
) => runOptimization(options, observe, Option.none())

const runOptimization = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R, EE, ER>(
  options: Options<I, O, ME, MR, E, R>,
  observe: EventSink<EE, ER>,
  checkpoint: Option.Option<State>
) =>
  Effect.gen(function*() {
    const auto = options.auto ?? Option.none()
    const maxMetricCalls = Option.fromUndefinedOr(options.maxMetricCalls)
    const maxFullEvals = Option.fromUndefinedOr(options.maxFullEvals)
    if (
      Arr.filter(
        [Option.isSome(auto), Option.isSome(maxMetricCalls), Option.isSome(maxFullEvals)],
        (present) => present
      ).length !== 1
    ) {
      return yield* new GEPAError({
        reason: "invalid-options",
        message: "Exactly one of auto, maxMetricCalls, or maxFullEvals must be set"
      })
    }
    if (options.trainset.length === 0) {
      return yield* new GEPAError({ reason: "invalid-dataset", message: "Trainset must be provided and non-empty" })
    }
    if (!Schema.is(Schema.Int.check(Schema.isGreaterThan(0)))(options.reflectionMinibatchSize ?? 3)) {
      return yield* new GEPAError({
        reason: "invalid-options",
        message: "reflectionMinibatchSize must be a positive integer"
      })
    }
    const valset = options.valset && options.valset.length > 0 ? options.valset : options.trainset
    if (options.requireDistinctValset) {
      const trainIds = yield* Effect.forEach(options.trainset, exampleId)
      const valIds = yield* Effect.forEach(valset, exampleId)
      if (Arr.some(valIds, (id) => Arr.contains(trainIds, id))) {
        return yield* new GEPAError({
          reason: "invalid-dataset",
          message: "requireDistinctValset requires non-overlapping training and validation examples"
        })
      }
    }
    const recorded = yield* Ref.make(Arr.empty<Event>())
    const emit: EventSink<EE, ER> = (event) =>
      Ref.update(recorded, Arr.append(event)).pipe(Effect.andThen(observe(event)))
    const paramRefs = Arr.filter(Arr.fromIterable(predictors(options.module)), (predictor) => !predictor.frozen)
    const budget = Option.match(auto, {
      onNone: () =>
        Option.match(maxFullEvals, {
          onNone: () => Option.getOrElse(maxMetricCalls, () => 0),
          onSome: (count) => count * (options.trainset.length + (options.valset?.length ?? 0))
        }),
      onSome: (mode) => {
        const n = mode === "light" ? 6 : mode === "medium" ? 12 : 18
        const trials = Numeric.truncate(
          Numeric.max(4 * Numeric.max(paramRefs.length, 1) * Numeric.log(n) / Numeric.log(2), 1.5 * n)
        )
        const size = options.valset?.length ?? options.trainset.length
        return size + n * 5 + trials * 35 +
          (Numeric.floor((trials + 1) / 5) + 1 + (trials > 0 && trials < 5 ? 1 : 0)) * size
      }
    })
    if (!Numeric.isFinite(budget) || !Schema.is(Schema.Int)(options.seed ?? 0)) {
      return yield* new GEPAError({
        reason: "invalid-options",
        message: "Metric budget must be finite and seed must be an integer"
      })
    }
    if (!options.instructionProposer && (yield* ModelBinder.Current) === ModelBinder.identity) {
      yield* Effect.logWarning(
        "GEPA has no critic ModelBinder; reflection uses the caller's task LanguageModel and provider defaults"
      )
    }
    const rng = yield* PseudoRandom.makeCPython(options.seed ?? 0)
    const adapterRng = yield* PseudoRandom.makeCPython(options.seed ?? 0)
    const initialInstructions = yield* Effect.forEach(paramRefs, (predictor) =>
      Binding.read(predictor.parameters, predictor.path).pipe(
        Effect.map((parameters) =>
          new PredictorInstruction({ predictorName: predictor.path, instruction: parameters.instructions })
        )
      )).pipe(Binding.withPredictors(predictors(options.module)))
    const initialCandidate = new ProgramCandidate({
      candidateId: "candidate-0",
      parentIds: Arr.empty<string>(),
      predictorInstructions: initialInstructions
    })
    const initial = yield* Option.match(checkpoint, {
      onSome: (state) =>
        rng.restore(state.orchestrationRandom).pipe(
          Effect.andThen(adapterRng.restore(state.adapterRandom)),
          Effect.as(state)
        ),
      onNone: () =>
        Effect.gen(function*() {
          const evaluation = yield* evaluateCandidate(options, initialCandidate, valset, "select")
          return new State({
            iteration: 0,
            candidates: [initialCandidate],
            scoreVectors: [evaluation.scores],
            paretoSnapshot: deriveParetoKernelSnapshot([evaluation.scores]),
            componentCursors: [0],
            metricCalls: valset.length,
            feedbackMetricCalls: 0,
            orchestrationRandom: yield* rng.snapshot,
            adapterRandom: yield* adapterRng.snapshot,
            batch: new BatchState({
              shuffled: [],
              frequencies: [],
              epoch: -1,
              iteration: -1,
              calls: 0,
              trainsetSize: options.trainset.length
            }),
            mergesDue: 0,
            acceptedMerges: 0,
            lastIterationFoundNew: false,
            mergeTriplets: [],
            mergeDescriptions: []
          })
        })
    })
    yield* emit(events.Checkpoint({ state: initial }))
    const stateRef = yield* Ref.make(initial)
    const shouldContinue = (state: State) =>
      state.metricCalls < budget && state.iteration < (options.maxIterations ?? Number.POSITIVE_INFINITY) &&
      paramRefs.length > 0
    const finalState = yield* Effect.gen(function*() {
      const state = yield* Ref.get(stateRef)
      if (!shouldContinue(state)) {
        return state
      }
      const iteration = state.iteration + 1
      yield* emit(events.IterationStarted({ iteration, frontierSize: state.paretoSnapshot.frontierIndices.length }))
      const merged = yield* runMergePhase(options, state, valset, rng, emit)
      const outcome = merged.attempted
        ? merged
        : yield* runMutationPhase(options, merged.state, valset, rng, adapterRng, emit)
      const snapshot = deriveParetoKernelSnapshot(outcome.state.scoreVectors)
      const next = new State(Struct.assign(outcome.state, {
        iteration,
        paretoSnapshot: snapshot,
        orchestrationRandom: yield* rng.snapshot,
        adapterRandom: yield* adapterRng.snapshot
      }))
      yield* emit(
        events.ParetoUpdated({
          iteration,
          frontierIndices: snapshot.frontierIndices,
          dominatedIndices: snapshot.dominatedIndices,
          parentWeights: snapshot.parentWeights
        })
      )
      yield* emit(
        events.IterationCompleted({
          iteration,
          acceptedCandidate: outcome.accepted,
          frontierSize: snapshot.frontierIndices.length
        })
      )
      yield* emit(events.Checkpoint({ state: next }))
      yield* Ref.set(stateRef, next)
      return next
    }).pipe(Effect.repeat({ while: shouldContinue }))
    const bestCandidate = Option.getOrThrow(Arr.get(finalState.candidates, bestIndex(finalState.scoreVectors)))
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
 * @returns A bound module with the highest aggregate validation score.
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

/** Continues an encoded checkpoint without replaying evaluations or reseeding.
 * The module, metric and datasets must match the original run. maxIterations is
 * an absolute iteration boundary; raise or remove it when continuing.
 * @since 0.7.0
 * @category constructors
 */
export const resume = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR,
  E,
  R,
  EE = never,
  ER = never
>(
  options: Options<I, O, ME, MR, E, R>,
  state: State,
  observe: EventSink<EE, ER> = noEvents
) => runOptimization(options, observe, Option.some(state))

/**
 * Emits GEPA lifecycle events while stream consumption drives optimization.
 *
 * @remarks
 * The stream completes after `OptimizationCompleted` and contains events only.
 * Use `runWithEvents` to retain the bound result. Rollout failures receive
 * failureScore; feedback/proposal failures fail the stream. Caller parameters
 * remain unchanged.
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
