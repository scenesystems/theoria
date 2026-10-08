/**
 * Searches teacher-derived demonstrations and generated instructions in three
 * ordered phases.
 *
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al., "Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs", 2024}
 * @since 0.1.0
 * @module
 */
import type { ModelSettings } from "@scenesystems/effect-lm/ModelSettings"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as PseudoRandom from "@scenesystems/effect-math/PseudoRandom"
import {
  Array as Arr,
  Boolean as Bool,
  Data,
  Effect,
  Inspectable,
  Match,
  Number as Num,
  Option,
  Ref,
  Schema,
  Stream,
  String as Str,
  Struct
} from "effect"
import { Example } from "./Example.js"
import { Phase3Config } from "./internal/miprov2/runtime/model.js"
import {
  resolveOptions,
  toPhase1Options,
  toPhase2Options,
  toPhase3Options
} from "./internal/miprov2/runtime/options.js"
import { streamMIPROv2Events } from "./internal/miprov2/runtime/stream.js"
import * as MiproSampling from "./internal/miprov2/sampling.js"
import type { Metric } from "./Metric.js"
import {
  generateDemoCandidates,
  type PredictorDemoCandidateSets,
  type PredictorInstructionCandidateSets,
  proposeInstructionCandidates
} from "./MIPROv2Candidates.js"
import { run as runPhase3Search } from "./MIPROv2Search.js"
import type { Module as DspModule } from "./Module.js"
import * as Optimized from "./Optimized.js"

/**
 * Ordered dataset rows consumed by all MIPROv2 phases.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Examples = Schema.Array(Example)

/**
 * Ordered dataset rows consumed by all MIPROv2 phases.
 *
 * @since 0.1.0
 * @category type-level
 */
export type Examples = typeof Examples.Type

/** A scored study row, numbered including the baseline and inserted checkpoints.
 * @since 0.7.0
 * @category models
 */
export class TrialEvaluation extends Schema.Class<TrialEvaluation>("@scenesystems/effect-dsp/MIPROv2/TrialEvaluation")({
  trial: Schema.Int,
  config: Phase3Config,
  score: Schema.Finite,
  fullValidation: Schema.Boolean,
  sampled: Schema.Boolean
}) {}

/** Lifecycle events emitted by MIPROv2 phases.
 * @since 0.1.0
 * @category events
 */
export const Event = Schema.Union([
  Schema.TaggedStruct("Phase1Started", { numCandidates: Schema.Finite }),
  Schema.TaggedStruct("DemoCandidate", { predictorIndex: Schema.Finite, candidateIndex: Schema.Finite }),
  Schema.TaggedStruct("Phase1Completed", { totalCandidates: Schema.Finite }),
  Schema.TaggedStruct("Phase2Started", { numInstructions: Schema.Finite }),
  Schema.TaggedStruct("InstructionProposed", { predictorIndex: Schema.Finite, instruction: Schema.String }),
  Schema.TaggedStruct("Phase2Completed", { totalInstructions: Schema.Finite }),
  Schema.TaggedStruct("Phase3Started", { numTrials: Schema.Finite }),
  Schema.TaggedStruct("TrialEvaluated", TrialEvaluation.fields),
  Schema.TaggedStruct("FullEvalCompleted", { bestScore: Schema.Finite }),
  Schema.TaggedStruct("Phase3Completed", { bestScore: Schema.Finite, totalTrials: Schema.Finite })
])

/** MIPROv2 lifecycle event.
 * @since 0.1.0
 * @category events
 */
export type Event = typeof Event.Type

/** Constructors and exhaustive matching for MIPROv2 events.
 * @since 0.1.0
 * @category events
 */
export const events = Data.taggedEnum<Event>()

/** Formatted MIPROv2 progress line.
 * @since 0.1.0
 * @category models
 */
export class ProgressLine extends Schema.Class<ProgressLine>("@scenesystems/effect-dsp/MIPROv2/ProgressLine")({
  tag: Schema.String,
  details: Schema.String,
  text: Schema.String
}) {}

const render = (label: string, value: unknown): string => Str.concat(label, Inspectable.toStringUnknown(value))
const details = (event: Event): string =>
  Match.value(event).pipe(
    Match.tag("Phase1Started", ({ numCandidates }) => render("numCandidates=", numCandidates)),
    Match.tag("DemoCandidate", ({ predictorIndex, candidateIndex }) =>
      Arr.join(Arr.make(render("predictorIndex=", predictorIndex), render("candidateIndex=", candidateIndex)), " ")),
    Match.tag("Phase1Completed", ({ totalCandidates }) =>
      render("totalCandidates=", totalCandidates)),
    Match.tag("Phase2Started", ({ numInstructions }) =>
      render("numInstructions=", numInstructions)),
    Match.tag("InstructionProposed", ({ predictorIndex, instruction }) =>
      Arr.join(
        Arr.make(render("predictorIndex=", predictorIndex), render("instructionLength=", Str.length(instruction))),
        " "
      )),
    Match.tag("Phase2Completed", ({ totalInstructions }) => render("totalInstructions=", totalInstructions)),
    Match.tag("Phase3Started", ({ numTrials }) => render("numTrials=", numTrials)),
    Match.tag("TrialEvaluated", ({ trial, score }) =>
      Arr.join(Arr.make(render("trial=", trial), render("score=", score)), " ")),
    Match.tag("FullEvalCompleted", ({ bestScore }) =>
      render("bestScore=", bestScore)),
    Match.tag("Phase3Completed", ({ bestScore, totalTrials }) =>
      Arr.join(Arr.make(render("bestScore=", bestScore), render("totalTrials=", totalTrials)), " ")),
    Match.exhaustive
  )

/** Formats one MIPROv2 event without exposing instruction content.
 * @since 0.1.0
 * @category formatters
 */
export const formatEvent = (event: Event): ProgressLine => {
  const value = details(event)
  return new ProgressLine({ tag: event._tag, details: value, text: Str.concat(Str.concat(event._tag, " "), value) })
}

/** Effectful formatted-progress observer.
 * @since 0.1.0
 * @category models
 */
export type ProgressSink<E = never, R = never> = (line: ProgressLine) => Effect.Effect<void, E, R>

/** Observes MIPROv2 progress without changing stream values.
 * @since 0.1.0
 * @category combinators
 */
export const tapProgress =
  <E, R>(sink: ProgressSink<E, R>) =>
  <SE, SR>(stream: Stream.Stream<Event, SE, SR>): Stream.Stream<Event, E | SE, R | SR> =>
    Stream.tap(stream, (event) => sink(formatEvent(event)))

/** Folded MIPROv2 lifecycle counters.
 * @since 0.7.0
 * @category models
 */
export class Report extends Schema.Class<Report>("@scenesystems/effect-dsp/MIPROv2/Report")({
  totalEvents: Schema.Finite,
  demoCandidateCount: Schema.Finite,
  instructionProposedCount: Schema.Finite,
  trialEvaluatedCount: Schema.Finite,
  fullEvalCompletedCount: Schema.Finite,
  phase3StartedSeen: Schema.Boolean,
  phase3CompletedSeen: Schema.Boolean,
  phase3ConfiguredTrials: Schema.Finite,
  phase3CompletedTrials: Schema.Finite,
  phase3BestScoreSeen: Schema.Boolean,
  phase3BestScore: Schema.Finite,
  trials: Schema.Array(TrialEvaluation),
  checkpoints: Schema.Array(TrialEvaluation)
}) {}

const emptySummary = new Report({
  totalEvents: 0,
  demoCandidateCount: 0,
  instructionProposedCount: 0,
  trialEvaluatedCount: 0,
  fullEvalCompletedCount: 0,
  phase3StartedSeen: false,
  phase3CompletedSeen: false,
  phase3ConfiguredTrials: 0,
  phase3CompletedTrials: 0,
  phase3BestScoreSeen: false,
  phase3BestScore: 0,
  trials: [],
  checkpoints: []
})
const scoreFields = (summary: Report, score: number) => ({
  phase3BestScoreSeen: true,
  phase3BestScore: Bool.match(summary.phase3BestScoreSeen, {
    onFalse: () => score,
    onTrue: () => Numeric.max(summary.phase3BestScore, score)
  })
})

/** Summarizes MIPROv2 lifecycle events.
 * @since 0.1.0
 * @category combinators
 */
export const summarizeEvents = (input: Iterable<Event>): Report =>
  Arr.reduce(input, emptySummary, (summary, event) => {
    const fields = Match.value(event).pipe(
      Match.tagsExhaustive({
        Phase1Started: () => ({}),
        DemoCandidate: () => ({ demoCandidateCount: Num.increment(summary.demoCandidateCount) }),
        Phase1Completed: () => ({}),
        Phase2Started: () => ({}),
        InstructionProposed: () => ({ instructionProposedCount: Num.increment(summary.instructionProposedCount) }),
        Phase2Completed: () => ({}),
        Phase3Started: ({ numTrials }) => ({ phase3StartedSeen: true, phase3ConfiguredTrials: numTrials }),
        TrialEvaluated: (evaluation) => ({
          ...Bool.match(evaluation.fullValidation, {
            onFalse: () => ({}),
            onTrue: () => scoreFields(summary, evaluation.score)
          }),
          trialEvaluatedCount: Num.increment(summary.trialEvaluatedCount),
          trials: Arr.append(summary.trials, new TrialEvaluation(evaluation)),
          checkpoints: Bool.match(evaluation.fullValidation && !evaluation.sampled && evaluation.trial > 0, {
            onFalse: () => summary.checkpoints,
            onTrue: () => Arr.append(summary.checkpoints, new TrialEvaluation(evaluation))
          })
        }),
        FullEvalCompleted: ({ bestScore }) => ({
          ...scoreFields(summary, bestScore),
          fullEvalCompletedCount: Num.increment(summary.fullEvalCompletedCount)
        }),
        Phase3Completed: ({ bestScore, totalTrials }) => ({
          ...scoreFields(summary, bestScore),
          phase3CompletedSeen: true,
          phase3CompletedTrials: totalTrials
        })
      })
    )
    return new Report(Struct.assign(summary, {
      totalEvents: Num.increment(summary.totalEvents),
      ...fields
    }))
  })

/** Compares retained and search scores with a supplied baseline.
 * @since 0.1.0
 * @category models
 */
export class OptimizationObservability
  extends Schema.Class<OptimizationObservability>("@scenesystems/effect-dsp/MIPROv2/OptimizationObservability")({
    baselineScore: Schema.Finite,
    optimizedScore: Schema.Finite,
    searchBestScoreSeen: Schema.Boolean,
    searchBestScore: Schema.Finite,
    searchGain: Schema.Finite,
    retainedGain: Schema.Finite,
    retainedVsSearchGap: Schema.Finite,
    searchImprovedButRetainedFlat: Schema.Boolean
  })
{}

/** Computes retained and search-score differences.
 * @since 0.1.0
 * @category constructors
 */
export const summarizeOptimization = (options: {
  readonly baselineScore: number
  readonly optimizedScore: number
  readonly eventSummary: Report
}): OptimizationObservability => {
  const searchBestScore = Bool.match(options.eventSummary.phase3BestScoreSeen, {
    onFalse: () => options.optimizedScore,
    onTrue: () => options.eventSummary.phase3BestScore
  })
  const searchGain = Num.subtract(searchBestScore, options.baselineScore)
  const retainedGain = Num.subtract(options.optimizedScore, options.baselineScore)
  return new OptimizationObservability({
    baselineScore: options.baselineScore,
    optimizedScore: options.optimizedScore,
    searchBestScoreSeen: options.eventSummary.phase3BestScoreSeen,
    searchBestScore,
    searchGain,
    retainedGain,
    retainedVsSearchGap: Num.subtract(searchBestScore, options.optimizedScore),
    searchImprovedButRetainedFlat: Bool.and(
      Num.isGreaterThan(searchGain, 0),
      Num.isLessThanOrEqualTo(retainedGain, 0)
    )
  })
}

/**
 * Configures candidate construction, instruction generation, and TPE selection.
 *
 * @typeParam I - Input fields accepted by the optimized module.
 * @typeParam O - Output fields scored by the configured metric.
 * @typeParam ME - Expected failure from the configured metric.
 * @typeParam MR - Services required by the configured metric.
 *
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
  /** Program evaluated under immutable predictor overlays. */
  readonly module: DspModule<I, O, E, R>
  /** Examples used for teacher bootstrapping, labeled filling and proposal context. */
  readonly trainset: Examples
  /** Validation set; omission takes the last min(1000, floor(80%)) rows, at least one. */
  readonly valset?: Examples
  /** Single objective used for baseline, minibatch, and full-set evaluations. */
  readonly metric: Metric<ME, MR>
  /** Auto budget, default Some("light"). None requires numCandidates and numTrials. */
  readonly auto?: Option.Option<"light" | "medium" | "heavy">
  /** Explicit candidate count, default absent. Mutually exclusive with auto. */
  readonly numCandidates?: number
  /** Integer seed for one CPython stream shared across all phases. Defaults to 9. */
  readonly seed?: number
  /** Labeled-demo capacity, default 4. */
  readonly maxLabeledDemos?: number
  /** Accepted teacher-demo cap, default 4. Zero-shot still bootstraps proposer evidence. */
  readonly maxBootstrappedDemos?: number
  /** Teacher program; defaults to an immutable student snapshot. */
  readonly teacher?: DspModule<I, O, E, R>
  /** Generation settings applied only to teacher calls. */
  readonly teacherSettings?: ModelSettings
  /** Optional bootstrap acceptance threshold; absent accepts nonzero scores. */
  readonly metricThreshold?: Option.Option<number>
  /** Failure count that stops bootstrapping (raising) or an evaluation (scoring it 0); absent or none
   * uses DSPy's `dspy.settings.max_errors`, 10, for bootstrap and every Phase 3 evaluation. */
  readonly maxErrors?: Option.Option<number>
  /** Evaluation concurrency; absent uses the evaluator's default. */
  readonly numThreads?: number
  /** Proposal model temperature, default 1. */
  readonly initTemperature?: number
  /** Provider-independent overrides for proposer calls. */
  readonly proposerSettings?: ModelSettings
  /** Describe the program and predictor for every proposal, default true. */
  readonly programAwareProposer?: boolean
  /** Generate and cache a dataset summary, default true. */
  readonly dataAwareProposer?: boolean
  /** Draw a prompting tip before each rollout ID, default true. */
  readonly tipAwareProposer?: boolean
  /** Include up to three augmented demonstrations, default true. */
  readonly fewshotAwareProposer?: boolean
  /** Rows per dataset-description call, default 10. */
  readonly viewDataBatchSize?: number
  /** Number of sampled objective calls, excluding baseline and checkpoints; absent in auto mode. */
  readonly numTrials?: number
  /** Use fresh validation minibatches, default true. Auto uses valset.length > 50 instead. */
  readonly minibatch?: boolean
  /** Number of validation rows sampled per objective, default 35. */
  readonly minibatchSize?: number
  /** Insert a full-validation checkpoint after this many sampled trials, default 5. */
  readonly minibatchFullEvalSteps?: number
  /** Phase 3 evaluation diagnostics, compile's provide_traceback; absent is DSPy's setting, false.
   * Every failed validation example is logged at error level with its input. False appends a hint to
   * enable tracebacks; true attaches the failure's Cause, including its stack. Bootstrap and proposal
   * are unaffected. A cancelled evaluation is always logged with its cause before scoring 0. */
  readonly provideTraceback?: boolean
}> {}

/**
 * Receives lifecycle events in execution order. The optimizer waits for each
 * returned Effect before continuing.
 *
 * @since 0.1.0
 * @category models
 */
export type EventSink<E = never, R = never> = (event: Event) => Effect.Effect<void, E, R>

/**
 * Discards lifecycle events without adding a failure or service requirement.
 *
 * @since 0.1.0
 * @category constants
 */
export const noEvents: EventSink = () => Effect.void

const emitPhase1Candidates = <E, R>(
  demoCandidates: PredictorDemoCandidateSets,
  emit: EventSink<E, R>
) =>
  Effect.forEach(
    demoCandidates,
    (candidateSet, predictorIndex) =>
      Effect.forEach(candidateSet.candidates, (_candidate, candidateIndex) =>
        emit(
          events.DemoCandidate({
            predictorIndex,
            candidateIndex
          })
        ), { discard: true }),
    { discard: true }
  )

const emitPhase2Candidates = <E, R>(
  instructionCandidates: PredictorInstructionCandidateSets,
  emit: EventSink<E, R>
) =>
  Effect.forEach(
    instructionCandidates,
    (candidateSet, predictorIndex) =>
      Effect.forEach(candidateSet.candidates, (candidate) =>
        emit(
          events.InstructionProposed({
            predictorIndex,
            instruction: candidate.instruction
          })
        ), { discard: true }),
    { discard: true }
  )

const totalDemoCandidates = (
  demoCandidates: PredictorDemoCandidateSets
): number => Arr.reduce(demoCandidates, 0, (count, candidateSet) => Num.sum(count, Arr.length(candidateSet.candidates)))

const totalInstructionCandidates = (
  instructionCandidates: PredictorInstructionCandidateSets
): number =>
  Arr.reduce(instructionCandidates, 0, (count, candidateSet) => Num.sum(count, Arr.length(candidateSet.candidates)))

/**
 * Runs all MIPROv2 phases and reports their lifecycle events.
 *
 * @remarks
 * Phase 1 builds per-predictor candidates from teacher traces and labeled
 * examples without changing instructions. Phase 2 asks the configured language model for alternatives in
 * predictor order. Phase 3 evaluates a baseline, then runs a single-concurrency
 * TPE optimization with fresh CPython-sampled minibatches. Full-validation
 * checkpoints are inserted into the study and alone determine the returned program.
 *
 * The selected instructions and demonstrations are returned in a bound copy.
 * Success, failure, and interruption leave caller parameter refs unchanged.
 * Instruction generation failures become `InstructionProposalFailed`.
 * Candidate mismatch and an absence of successful trials become
 * `AllTrialsFailed`. Effect-search optimization failures retain their `SearchError`
 * variants. Module, metric, Schema, and language-model failures retain their
 * declared error channels.
 *
 * @param options - Candidate, proposal, validation, and search settings.
 * @returns The bound program, immutable parameters, and serializable search report.
 * @typeParam I - Input fields accepted by the optimized module.
 * @typeParam O - Output fields scored by the configured metric.
 * @typeParam ME - Expected failure from the configured metric.
 * @typeParam MR - Services required by the configured metric.
 *
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al. (2024)}
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
    const resolved = yield* resolveOptions(options)

    yield* emit(events.Phase1Started({ numCandidates: resolved.numCandidates }))

    const demoCandidates = yield* generateDemoCandidates(toPhase1Options(resolved))

    yield* emitPhase1Candidates(demoCandidates, emit)

    yield* emit(
      events.Phase1Completed({
        totalCandidates: totalDemoCandidates(demoCandidates)
      })
    )

    yield* emit(events.Phase2Started({ numInstructions: resolved.numInstructions }))

    const instructionCandidates = yield* proposeInstructionCandidates(toPhase2Options(resolved, demoCandidates))

    yield* emitPhase2Candidates(instructionCandidates, emit)

    yield* emit(
      events.Phase2Completed({
        totalInstructions: totalInstructionCandidates(instructionCandidates)
      })
    )

    yield* emit(events.Phase3Started({ numTrials: resolved.numTrials }))

    const phase3 = yield* runPhase3Search(
      toPhase3Options(
        resolved,
        emit,
        Bool.match(resolved.zeroShot, { onFalse: () => demoCandidates, onTrue: () => Arr.empty() }),
        instructionCandidates
      )
    )

    yield* emit(
      events.Phase3Completed({
        bestScore: phase3.diagnostics.bestScore,
        totalTrials: phase3.diagnostics.evaluations.length
      })
    )

    return new Optimized.Result({
      program: phase3.program,
      parameters: phase3.parameters,
      report: summarizeEvents(yield* Ref.get(recorded))
    })
  }).pipe(
    Effect.provideServiceEffect(
      MiproSampling.Current,
      PseudoRandom.makeCPython(Option.getOrElse(Option.fromUndefinedOr(options.seed), () => 9)).pipe(Effect.asSome)
    )
  )

/**
 * Runs MIPROv2 with lifecycle reporting disabled.
 *
 * @param options - Candidate, proposal, validation, and search settings.
 * @returns An Optimized.Result containing the bound program, selected parameters,
 * and report, without mutating the supplied module.
 * @typeParam I - Input fields accepted by the optimized module.
 * @typeParam O - Output fields scored by the configured metric.
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
 * Emits lifecycle events while stream consumption drives one MIPROv2 run.
 *
 * @remarks
 * The stream ends after `Phase3Completed`. It contains events only; use
 * {@link runWithEvents} when the caller also needs the returned module.
 *
 * @param options - Candidate, proposal, validation, and search settings.
 * @returns A lazy event stream with the optimizer's failure and service channels.
 * @typeParam I - Input fields accepted by the optimized module.
 * @typeParam O - Output fields scored by the configured metric.
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
) => streamMIPROv2Events((emit) => runWithEvents(options, emit))
