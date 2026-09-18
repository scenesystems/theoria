/**
 * Searches labeled demonstration subsets and generated instructions in three
 * ordered phases.
 *
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al., "Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs", 2024}
 * @since 0.1.0
 * @module
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import {
  Array as Arr,
  Boolean as Bool,
  Data,
  Effect,
  Inspectable,
  Match,
  Number as Num,
  Schema,
  Stream,
  String as Str
} from "effect"
import { Example } from "./Example.js"
import {
  type MIPROOptionLike,
  resolvePhase3TrialBudget,
  toPhase1Options,
  toPhase2Options,
  toPhase3Options
} from "./internal/miprov2/runtime/options.js"
import { streamMIPROv2Events } from "./internal/miprov2/runtime/stream.js"
import type { Metric } from "./Metric.js"
import {
  generateDemoCandidates,
  type PredictorDemoCandidateSets,
  type PredictorInstructionCandidateSets,
  proposeInstructionCandidates
} from "./MIPROv2Candidates.js"
import { run as runPhase3Search } from "./MIPROv2Search.js"
import type { Module as DspModule } from "./Module.js"

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

/**
 * Proposal hints selected by MIPROv2 Phase 2.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TipVocabulary = Schema.Array(Schema.String)

/**
 * Proposal hints selected by MIPROv2 Phase 2.
 *
 * @since 0.1.0
 * @category type-level
 */
export type TipVocabulary = typeof TipVocabulary.Type

/** Lifecycle events emitted by MIPROv2 phases.
 * @since 0.1.0
 * @category events
 */
export const Event = Schema.Union(
  Schema.TaggedStruct("Phase1Started", { numCandidates: Schema.Number }),
  Schema.TaggedStruct("DemoCandidate", { predictorIndex: Schema.Number, candidateIndex: Schema.Number }),
  Schema.TaggedStruct("Phase1Completed", { totalCandidates: Schema.Number }),
  Schema.TaggedStruct("Phase2Started", { numInstructions: Schema.Number }),
  Schema.TaggedStruct("InstructionProposed", { predictorIndex: Schema.Number, instruction: Schema.String }),
  Schema.TaggedStruct("Phase2Completed", { totalInstructions: Schema.Number }),
  Schema.TaggedStruct("Phase3Started", { numTrials: Schema.Number }),
  Schema.TaggedStruct("TrialEvaluated", { trial: Schema.Number, score: Schema.Number }),
  Schema.TaggedStruct("FullEvalCompleted", { bestScore: Schema.Number }),
  Schema.TaggedStruct("Phase3Completed", { bestScore: Schema.Number, totalTrials: Schema.Number })
)

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
  tag: Schema.typeSchema(Schema.pluck(Event, "_tag")),
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
 * @since 0.1.0
 * @category models
 */
export class EventSummary extends Schema.Class<EventSummary>("@scenesystems/effect-dsp/MIPROv2/EventSummary")({
  totalEvents: Schema.Number,
  demoCandidateCount: Schema.Number,
  instructionProposedCount: Schema.Number,
  trialEvaluatedCount: Schema.Number,
  fullEvalCompletedCount: Schema.Number,
  phase3StartedSeen: Schema.Boolean,
  phase3CompletedSeen: Schema.Boolean,
  phase3ConfiguredTrials: Schema.Number,
  phase3CompletedTrials: Schema.Number,
  phase3BestScoreSeen: Schema.Boolean,
  phase3BestScore: Schema.Number
}) {}

const emptySummary = new EventSummary({
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
  phase3BestScore: 0
})
const withScore = (summary: EventSummary, score: number): EventSummary =>
  new EventSummary({
    ...summary,
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
export const summarizeEvents = (input: Iterable<Event>): EventSummary =>
  Arr.reduce(input, emptySummary, (summary, event) => {
    const next = new EventSummary({ ...summary, totalEvents: Num.increment(summary.totalEvents) })
    return Match.value(event).pipe(
      Match.tagsExhaustive({
        Phase1Started: () => next,
        DemoCandidate: () => new EventSummary({ ...next, demoCandidateCount: Num.increment(next.demoCandidateCount) }),
        Phase1Completed: () => next,
        Phase2Started: () => next,
        InstructionProposed: () =>
          new EventSummary({ ...next, instructionProposedCount: Num.increment(next.instructionProposedCount) }),
        Phase2Completed: () => next,
        Phase3Started: ({ numTrials }) =>
          new EventSummary({ ...next, phase3StartedSeen: true, phase3ConfiguredTrials: numTrials }),
        TrialEvaluated: ({ score }) =>
          withScore(new EventSummary({ ...next, trialEvaluatedCount: Num.increment(next.trialEvaluatedCount) }), score),
        FullEvalCompleted: ({ bestScore }) =>
          withScore(
            new EventSummary({ ...next, fullEvalCompletedCount: Num.increment(next.fullEvalCompletedCount) }),
            bestScore
          ),
        Phase3Completed: ({ bestScore, totalTrials }) =>
          withScore(
            new EventSummary({ ...next, phase3CompletedSeen: true, phase3CompletedTrials: totalTrials }),
            bestScore
          )
      })
    )
  })

/** Compares retained and search scores with a supplied baseline.
 * @since 0.1.0
 * @category models
 */
export class OptimizationObservability
  extends Schema.Class<OptimizationObservability>("@scenesystems/effect-dsp/MIPROv2/OptimizationObservability")({
    baselineScore: Schema.Number,
    optimizedScore: Schema.Number,
    searchBestScoreSeen: Schema.Boolean,
    searchBestScore: Schema.Number,
    searchGain: Schema.Number,
    retainedGain: Schema.Number,
    retainedVsSearchGap: Schema.Number,
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
  readonly eventSummary: EventSummary
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
      Num.greaterThan(searchGain, 0),
      Num.lessThanOrEqualTo(retainedGain, 0)
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
  /** Module tree mutated during evaluation and left with the selected configuration on success. */
  readonly module: DspModule<I, O, E, R>
  /** Examples used for proposal context; only entries with `output` become demonstrations. */
  readonly trainset: Examples
  /** Phase 3 evaluation set. Defaults to `trainset`; no automatic split is performed. */
  readonly valset?: Examples
  /** Single objective used for baseline, minibatch, and full-set evaluations. */
  readonly metric: Metric<ME, MR, Schema.Schema.Type<Schema.Struct<O>>>
  /** Total demonstration candidates per predictor; fractional values round down and invalid counts become one. */
  readonly numCandidates: number
  /** Total instruction candidates per predictor, including the baseline at index zero. */
  readonly numInstructions: number
  /** Seed shared by candidate ordering, proposal selection, and TPE; normalized to a positive integer. */
  readonly seed?: number
  /** Labeled-demo cap for the `labels-only` candidate. Defaults to the labeled count clamped from one through four. */
  readonly maxLabeledDemos?: number
  /** Labeled-demo cap for bootstrap-named candidates. Defaults to the labeled count clamped from one through four. */
  readonly maxBootstrappedDemos?: number
  /** Numeric hint rendered into each proposal prompt. Defaults to `1`; it does not configure the model provider. */
  readonly diversityTemperature?: number
  /** Proposal hints selected cyclically. An empty or omitted array uses the built-in vocabulary. */
  readonly tipVocabulary?: TipVocabulary
  /** Phase 3 optimization trials; invalid counts become one and omission uses the search-space budget formula. */
  readonly trialBudget?: number
  /** Prefix size of `valset` used for every trial objective. Defaults to `50` and is normalized to a positive integer. */
  readonly minibatchSize?: number
  /** Trial cadence for diagnostic full-set evaluations. Defaults to `5` and is normalized to a positive integer. */
  readonly fullEvalEvery?: number
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
 * Phase 1 snapshots every owned predictor and builds candidates from labeled
 * examples. Phase 2 asks the configured language model for alternatives in
 * predictor order. Phase 3 evaluates a baseline, then runs a single-concurrency
 * TPE optimization whose trial objective uses the leading validation-set minibatch.
 * Periodic full-set evaluations update diagnostics without changing the TPE
 * objective or selected trial.
 *
 * The selected instruction and demonstration indexes are written to the same
 * module instance. Search evaluation mutates parameter refs as it runs, so a
 * failure or interruption can leave the most recently applied configuration in
 * place. Instruction generation failures become `InstructionProposalFailed`.
 * Candidate mismatch and an absence of successful trials become
 * `AllTrialsFailed`. Effect-search optimization failures retain their `SearchError`
 * variants. Module, metric, Schema, and language-model failures retain their
 * declared error channels.
 *
 * @param options - Candidate, proposal, validation, and search settings.
 * @param emit - Sink awaited once for each emitted lifecycle event.
 * @returns The supplied module after the selected configuration is applied.
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
  emit: EventSink<EE, ER>
) =>
  Effect.gen(function*() {
    const optionBag: MIPROOptionLike<I, O, ME, MR, E, R> = options

    yield* emit(events.Phase1Started({ numCandidates: options.numCandidates }))

    const demoCandidates = yield* generateDemoCandidates(toPhase1Options(optionBag))

    yield* emitPhase1Candidates(demoCandidates, emit)

    yield* emit(
      events.Phase1Completed({
        totalCandidates: totalDemoCandidates(demoCandidates)
      })
    )

    yield* emit(events.Phase2Started({ numInstructions: options.numInstructions }))

    const instructionCandidates = yield* proposeInstructionCandidates(toPhase2Options(optionBag, demoCandidates))

    yield* emitPhase2Candidates(instructionCandidates, emit)

    yield* emit(
      events.Phase2Completed({
        totalInstructions: totalInstructionCandidates(instructionCandidates)
      })
    )

    const resolvedPhase3TrialBudget = resolvePhase3TrialBudget(optionBag, demoCandidates, instructionCandidates)

    yield* emit(events.Phase3Started({ numTrials: resolvedPhase3TrialBudget }))

    const phase3 = yield* runPhase3Search(
      toPhase3Options(optionBag, emit, resolvedPhase3TrialBudget, demoCandidates, instructionCandidates)
    )

    yield* emit(
      events.Phase3Completed({
        bestScore: phase3.diagnostics.bestScore,
        totalTrials: phase3.diagnostics.trialBudget
      })
    )

    return options.module
  })

/**
 * Runs MIPROv2 with lifecycle reporting disabled.
 *
 * @param options - Candidate, proposal, validation, and search settings.
 * @returns The supplied module after the selected configuration is applied.
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

/** Caller-observed score, demonstration, and event outcomes.
 * @since 0.5.0
 * @category models
 */
export class OutcomeSummary extends Data.Class<{
  readonly baselineExactMatch: number
  readonly optimizedExactMatch: number
  readonly scoreDelta: number
  readonly demoCountBeforeOptimization: number
  readonly demoCountAfterOptimization: number
  readonly demosLearnedDuringMIPROv2: number
  readonly eventSummary: EventSummary
}> {}

/** Summarizes externally evaluated MIPROv2 outcomes.
 * @since 0.5.0
 * @category constructors
 */
export const summarizeOutcome = (options: {
  readonly baselineScore: number
  readonly optimizedScore: number
  readonly demoCountBefore: number
  readonly demoCountAfter: number
  readonly events: EventSummary
}): OutcomeSummary =>
  new OutcomeSummary({
    baselineExactMatch: options.baselineScore,
    optimizedExactMatch: options.optimizedScore,
    scoreDelta: Num.subtract(options.optimizedScore, options.baselineScore),
    demoCountBeforeOptimization: options.demoCountBefore,
    demoCountAfterOptimization: options.demoCountAfter,
    demosLearnedDuringMIPROv2: Num.subtract(options.demoCountAfter, options.demoCountBefore),
    eventSummary: options.events
  })
