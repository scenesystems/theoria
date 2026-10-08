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
import { candidateParameters, evaluateCandidate } from "./internal/gepa/runtime/evaluate.js"
import { runMergePhase } from "./internal/gepa/runtime/mergePhase.js"
import { bestIndex, runMutationPhase } from "./internal/gepa/runtime/mutation.js"
import { streamGEPAEvents } from "./internal/gepa/runtime/stream.js"
import { CheckpointContext, validateCheckpoint } from "./internal/gepa/validation.js"
import * as Binding from "./internal/parameterBinding.js"
import type { Metric } from "./Metric.js"
import { bound, type Module as DspModule } from "./Module.js"
import { predictors } from "./ModuleGraph.js"
import * as Optimized from "./Optimized.js"
import { Payload } from "./Payload.js"
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

/** Instruction text for one trainable predictor of a candidate program.
 * @since 0.7.0
 * @category models
 */
export class PredictorInstruction extends Schema.Class<PredictorInstruction>(
  "@scenesystems/effect-dsp/GEPA/PredictorInstruction"
)({
  predictorName: Schema.String,
  instruction: Schema.String
}) {}

/** A program in the GEPA population. Candidate `i` is `candidate-i`; parents
 * name earlier candidates, and instructions follow the module's trainable
 * predictor order. Custom instruction proposers receive the selected parent.
 * @since 0.7.0
 * @category models
 */
export class ProgramCandidate extends Schema.Class<ProgramCandidate>("@scenesystems/effect-dsp/GEPA/ProgramCandidate")({
  candidateId: Schema.String,
  parentIds: Schema.Array(Schema.String),
  predictorInstructions: Schema.Array(PredictorInstruction)
}) {}

/** Candidates attaining the best observed score on one validation example.
 * @since 0.7.0
 * @category models
 */
export class ExampleFrontierHolding extends Schema.Class<ExampleFrontierHolding>(
  "@scenesystems/effect-dsp/GEPA/ExampleFrontierHolding"
)({
  exampleIndex: Schema.Finite,
  bestScore: Schema.Finite,
  holders: Schema.Array(Schema.Finite)
}) {}

/** Parent-selection frequency: the number of validation examples on which a
 * candidate remains in the irredundant per-example cover.
 * @since 0.7.0
 * @category models
 */
export class ParentSelectionWeight extends Schema.Class<ParentSelectionWeight>(
  "@scenesystems/effect-dsp/GEPA/ParentSelectionWeight"
)({
  candidateIndex: Schema.Finite,
  weight: Schema.Finite
}) {}

/** Coverage front derived from the validation score vectors: frontier and
 * dominated candidate indices, raw per-example holdings and parent weights.
 * A checkpoint's snapshot must equal the one derived from its score vectors.
 * @since 0.7.0
 * @category models
 */
export class ParetoSnapshot extends Schema.Class<ParetoSnapshot>("@scenesystems/effect-dsp/GEPA/ParetoSnapshot")({
  frontierIndices: Schema.Array(Schema.Finite),
  dominatedIndices: Schema.Array(Schema.Finite),
  exampleHoldings: Schema.Array(ExampleFrontierHolding),
  parentWeights: Schema.Array(ParentSelectionWeight)
}) {}

/** Epoch-shuffled training minibatch schedule persisted with the orchestration RNG.
 * `shuffled` holds training-set indices for a training set of `trainsetSize` rows.
 * @since 0.7.0
 * @category models
 */
export class BatchState extends Schema.Class<BatchState>("@scenesystems/effect-dsp/GEPA/BatchState")({
  shuffled: Schema.Array(Schema.Int),
  frequencies: Schema.Array(Schema.Struct({ id: Schema.Int, count: Schema.Int })),
  epoch: Schema.Int,
  iteration: Schema.Int,
  calls: Schema.Int,
  trainsetSize: Schema.Int
}) {}

/** One reflective-feedback row offered to an instruction proposer: the
 * predictor execution's input and output, the expected output, feedback and
 * score. `predictor-execution` rows carry the targeted predictor's own call.
 * @since 0.7.0
 * @category models
 */
export class ReflectiveExample extends Schema.Class<ReflectiveExample>(
  "@scenesystems/effect-dsp/GEPA/ReflectiveExample"
)({
  exampleId: Schema.String,
  predictorName: Schema.String,
  evidenceScope: Schema.Literals(["predictor-execution", "program"]).pipe(
    Schema.withConstructorDefault(Effect.succeed("program"))
  ),
  inputs: Payload,
  generatedOutputs: Payload,
  expectedOutput: Payload,
  feedback: Schema.String,
  score: Schema.Finite
}) {}

/** Complete continuation state for exact replay of an uninterrupted run.
 * Carries both RNG streams, epoch-shuffled batch state, component cursors,
 * merge scheduler counters and deduplication records. With the same module,
 * datasets, metric, options and model responses, resuming reproduces the
 * uninterrupted run exactly.
 * Upstream gepa 0.1.4 pickles only GEPAState: its batch sampler and merge
 * proposer rebuild their RNGs (random.Random(0)) and counters on restart,
 * so an upstream resumed run does not reproduce its uninterrupted run.
 * `resume` rejects a state inconsistent with the module, datasets or its own
 * derived frontier with `GEPAError` reason `invalid-state` before evaluating.
 * @since 0.7.0
 * @category models
 */
export class State extends Schema.Class<State>("@scenesystems/effect-dsp/GEPA/State")({
  iteration: Schema.Int,
  candidates: Schema.Array(ProgramCandidate),
  scoreVectors: Schema.Array(Schema.Array(Schema.Finite)),
  paretoSnapshot: ParetoSnapshot,
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
  /** Absolute local iteration boundary for checkpointing, independent of the metric budget.
   * The returned State carries both RNG streams, epoch-shuffled batches, component
   * cursors, merge scheduler counters and deduplication records for exact continuation.
   * Upstream gepa 0.1.4 pickles only GEPAState and rebuilds the batch sampler and
   * merge proposer RNGs (random.Random(0)) and counters, losing uninterrupted-run
   * equivalence. Raise or remove this boundary when calling {@link resume}.
   */
  readonly maxIterations?: number
  readonly reflectionMinibatchSize?: number
  readonly candidateSelectionStrategy?: "pareto" | "currentBest"
  readonly skipPerfectScore?: boolean
  readonly addFormatFailureAsFeedback?: boolean
  readonly reflectionSettings?: ModelSettings
  /** Built-in predictor traversal follows stable Module.Structure path order.
   * Merge conflicts use the same order. Upstream gepa 0.1.4 iterates a Python
   * string set (merge.py:159–163): PYTHONHASHSEED controls its order and is
   * randomized per process by default. With two or more tied conflicts upstream
   * is not reproducible across processes; Theoria is deterministic.
   * Custom selectors must return trainable paths; unknown or frozen paths fail with `GEPAError`.
   */
  readonly componentSelector?: "roundRobin" | "all" | ((state: State) => Chunk.Chunk<Predictor.Path>)
  readonly instructionProposer?: (
    candidate: ProgramCandidate,
    components: Chunk.Chunk<Predictor.Path>,
    examples: Record.ReadonlyRecord<string, ReadonlyArray<ReflectiveExample>>
  ) => Effect.Effect<Record.ReadonlyRecord<string, string>, ME, MR>
  /** Enables merging in stable Module.Structure path order, including conflict resolution.
   * Upstream's Python string-set order depends on PYTHONHASHSEED and is randomized
   * per process by default, so two or more tied conflicts are not reproducible
   * across processes. Theoria's order is deterministic.
   */
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
 * @since 0.7.0
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
    const auto = Option.getOrElse(
      Option.fromUndefinedOr(options.auto),
      () => Option.none<"light" | "medium" | "heavy">()
    )
    const maxMetricCalls = Option.fromUndefinedOr(options.maxMetricCalls)
    const maxFullEvals = Option.fromUndefinedOr(options.maxFullEvals)
    const explicitValset = Option.fromUndefinedOr(options.valset)
    const seed = Option.getOrElse(Option.fromUndefinedOr(options.seed), () => 0)
    yield* Effect.failSync(() =>
      new GEPAError({
        reason: "invalid-options",
        message: "Exactly one of auto, maxMetricCalls, or maxFullEvals must be set"
      })
    ).pipe(
      Effect.when(Effect.succeed(
        Arr.filter(
          [Option.isSome(auto), Option.isSome(maxMetricCalls), Option.isSome(maxFullEvals)],
          (present) => present
        ).length !== 1
      ))
    )
    yield* Effect.failSync(() =>
      new GEPAError({ reason: "invalid-dataset", message: "Trainset must be provided and non-empty" })
    ).pipe(Effect.when(Effect.succeed(options.trainset.length === 0)))
    yield* Effect.failSync(() =>
      new GEPAError({
        reason: "invalid-options",
        message: "reflectionMinibatchSize must be a positive integer"
      })
    ).pipe(
      Effect.when(Effect.succeed(
        !Schema.is(Schema.Int.check(Schema.isGreaterThan(0)))(
          Option.getOrElse(Option.fromUndefinedOr(options.reflectionMinibatchSize), () => 3)
        )
      ))
    )
    const valset = Option.getOrElse(Option.filter(explicitValset, Arr.isReadonlyArrayNonEmpty), () => options.trainset)
    yield* Effect.gen(function*() {
      const trainIds = yield* Effect.forEach(options.trainset, exampleId)
      const valIds = yield* Effect.forEach(valset, exampleId)
      yield* Effect.failSync(() =>
        new GEPAError({
          reason: "invalid-dataset",
          message: "requireDistinctValset requires non-overlapping training and validation examples"
        })
      ).pipe(Effect.when(Effect.succeed(Arr.some(valIds, (id) => Arr.contains(trainIds, id)))))
    }).pipe(Effect.when(Effect.succeed(options.requireDistinctValset === true)))
    const recorded = yield* Ref.make(Arr.empty<Event>())
    const emit: EventSink<EE, ER> = (event) =>
      Ref.update(recorded, Arr.append(event)).pipe(Effect.andThen(observe(event)))
    const paramRefs = Arr.filter(Arr.fromIterable(predictors(options.module)), (predictor) => !predictor.frozen)
    const budget = Option.match(auto, {
      onNone: () =>
        Option.match(maxFullEvals, {
          onNone: () => Option.getOrElse(maxMetricCalls, () => 0),
          onSome: (count) =>
            count * (options.trainset.length + Option.match(explicitValset, {
              onNone: () => 0,
              onSome: (examples) => examples.length
            }))
        }),
      onSome: (mode) => {
        const n = Match.value(mode).pipe(
          Match.when("light", () => 6),
          Match.when("medium", () => 12),
          Match.orElse(() => 18)
        )
        const trials = Numeric.truncate(
          Numeric.max(4 * Numeric.max(paramRefs.length, 1) * Numeric.log(n) / Numeric.log(2), 1.5 * n)
        )
        const size = Option.match(explicitValset, {
          onNone: () => options.trainset.length,
          onSome: (examples) => examples.length
        })
        const shortRun = Boolean.match(trials > 0 && trials < 5, { onFalse: () => 0, onTrue: () => 1 })
        return size + n * 5 + trials * 35 + (Numeric.floor((trials + 1) / 5) + 1 + shortRun) * size
      }
    })
    yield* Effect.failSync(() =>
      new GEPAError({
        reason: "invalid-options",
        message: "Metric budget must be finite and seed must be an integer"
      })
    ).pipe(Effect.when(Effect.succeed(!Numeric.isFinite(budget) || !Schema.is(Schema.Int)(seed))))
    yield* Effect.logWarning(
      "GEPA has no critic ModelBinder; reflection uses the caller's task LanguageModel and provider defaults"
    ).pipe(
      Effect.when(Option.match(Option.fromUndefinedOr(options.instructionProposer), {
        onNone: () => Effect.map(ModelBinder.Current, (binder) => binder === ModelBinder.identity),
        onSome: () => Effect.succeed(false)
      }))
    )
    const rng = yield* PseudoRandom.makeCPython(seed)
    const adapterRng = yield* PseudoRandom.makeCPython(seed)
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
    const checkpointContext = new CheckpointContext({
      trainable: Arr.map(paramRefs, Struct.get("path")),
      frozen: Arr.map(
        Arr.filter(Arr.fromIterable(predictors(options.module)), Struct.get("frozen")),
        Struct.get("path")
      ),
      trainsetSize: options.trainset.length,
      valsetSize: valset.length
    })
    const initial = yield* Option.match(checkpoint, {
      onSome: (state) =>
        validateCheckpoint(state, checkpointContext).pipe(
          Effect.andThen(rng.restore(state.orchestrationRandom)),
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
    const maxIterations = Option.getOrElse(Option.fromUndefinedOr(options.maxIterations), () =>
      Number.POSITIVE_INFINITY)
    const shouldContinue = (state: State) =>
      state.metricCalls < budget && state.iteration < maxIterations && paramRefs.length > 0
    const iterate = (state: State) =>
      Effect.gen(function*() {
        const iteration = state.iteration + 1
        yield* emit(events.IterationStarted({ iteration, frontierSize: state.paretoSnapshot.frontierIndices.length }))
        const merged = yield* runMergePhase(options, state, valset, rng, emit)
        const outcome = yield* Boolean.match(merged.attempted, {
          onFalse: () =>
            runMutationPhase(options, merged.state, valset, rng, adapterRng, emit),
          onTrue: () => Effect.succeed(merged)
        })
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
      })
    const finalState = yield* Effect.gen(function*() {
      const state = yield* Ref.get(stateRef)
      return yield* Boolean.match(shouldContinue(state), {
        onFalse: () => Effect.succeed(state),
        onTrue: () => iterate(state)
      })
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
 * Restores both RNG streams, epoch-shuffled batch state, component cursors,
 * merge scheduler counters and deduplication records, reproducing the uninterrupted
 * run exactly with matching module, datasets, metric, options and model responses.
 * Upstream gepa 0.1.4 pickles only GEPAState; its batch sampler and merge proposer
 * rebuild their RNGs (random.Random(0)) and counters on restart, so an upstream
 * resumed run does not reproduce its uninterrupted run.
 * maxIterations is an absolute iteration boundary; raise or remove it when continuing.
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
