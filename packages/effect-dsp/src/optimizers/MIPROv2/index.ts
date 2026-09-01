/**
 * MIPROv2 optimizer — three-phase instruction and demonstration optimization
 * via grounded proposal and Bayesian search.
 *
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al., "Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs", 2024}
 * @since 0.1.0
 */
import { Array as Arr, Effect } from "effect"
import type { Schema } from "effect"
import type { Example } from "../../Example/index.js"
import type { Metric } from "../../Metric/model.js"
import type { Module as DspModule } from "../../Module/model.js"
import { generateDemoCandidates, type PredictorDemoCandidates } from "./bootstrap.js"
import { MIPROv2Event, type MIPROv2Event as MIPROv2EventType } from "./events.js"
import { type PredictorInstructionCandidates, proposeInstructionCandidates } from "./propose.js"
import {
  type MIPROOptionLike,
  resolvePhase3TrialBudget,
  toPhase1Options,
  toPhase2Options,
  toPhase3Options
} from "./runtime/options.js"
import { streamMIPROv2Events } from "./runtime/stream.js"
import { runPhase3Search } from "./search.js"

/**
 * Controls demonstration generation, grounded instruction proposal, and
 * Bayesian selection across the three MIPROv2 phases.
 *
 * @since 0.1.0
 * @category models
 */
export type MIPROv2Options<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never
> = Readonly<{
  /** Module mutated during search and left with the selected Phase 3 configuration. */
  readonly module: DspModule<I, O>
  /** Labeled examples used for demo candidates and proposal grounding. */
  readonly trainset: ReadonlyArray<Example>
  /** Phase 3 evaluation set. Defaults to `trainset`; no automatic split is performed. */
  readonly valset?: ReadonlyArray<Example>
  /** Objective metric used by Phase 3. */
  readonly metric: Metric<ME, MR>
  /** Requested Phase 1 candidate count, normalized to a positive count. */
  readonly numCandidates: number
  /** Number of generated alternatives per predictor, excluding the retained baseline. */
  readonly numInstructions: number
  /** Deterministic proposal, candidate, minibatch, and TPE seed. Defaults to `1`. */
  readonly seed?: number
  readonly maxLabeledDemos?: number
  readonly maxBootstrappedDemos?: number
  readonly diversityTemperature?: number
  readonly tipVocabulary?: ReadonlyArray<string>
  /** Phase 3 study trials; when omitted a deterministic space-size formula is used. */
  readonly trialBudget?: number
  /** Prefix size of `valset` used for minibatch evaluations. */
  readonly minibatchSize?: number
  /** Positive cadence for full validation evaluations. */
  readonly fullEvalEvery?: number
}>

/**
 * Callback invoked with each MIPROv2 lifecycle event for streaming progress.
 *
 * @since 0.1.0
 * @category models
 */
export type MIPROv2EventSink = (event: MIPROv2EventType) => Effect.Effect<void>

/**
 * No-op event sink that discards all MIPROv2 events.
 *
 * @since 0.1.0
 * @category constants
 */
export const noMIPROv2Events: MIPROv2EventSink = () => Effect.void

const emitPhase1Candidates = (
  demoCandidates: ReadonlyArray<PredictorDemoCandidates>,
  emit: MIPROv2EventSink
) =>
  Effect.forEach(
    demoCandidates,
    (candidateSet, predictorIndex) =>
      Effect.forEach(candidateSet.candidates, (_candidate, candidateIndex) =>
        emit(
          MIPROv2Event.DemoCandidate({
            predictorIndex,
            candidateIndex
          })
        ), { discard: true }),
    { discard: true }
  )

const emitPhase2Candidates = (
  instructionCandidates: ReadonlyArray<PredictorInstructionCandidates>,
  emit: MIPROv2EventSink
) =>
  Effect.forEach(
    instructionCandidates,
    (candidateSet, predictorIndex) =>
      Effect.forEach(candidateSet.candidates, (candidate) =>
        emit(
          MIPROv2Event.InstructionProposed({
            predictorIndex,
            instruction: candidate.instruction
          })
        ), { discard: true }),
    { discard: true }
  )

const totalDemoCandidates = (
  demoCandidates: ReadonlyArray<PredictorDemoCandidates>
): number => Arr.reduce(demoCandidates, 0, (count, candidateSet) => count + candidateSet.candidates.length)

const totalInstructionCandidates = (
  instructionCandidates: ReadonlyArray<PredictorInstructionCandidates>
): number => Arr.reduce(instructionCandidates, 0, (count, candidateSet) => count + candidateSet.candidates.length)

/**
 * Optimizes a module with MIPROv2 while reporting progress to an event sink.
 *
 * @remarks
 * The event sink is sequentially awaited. Phase 1 deterministically assembles
 * labeled/demo anchors, Phase 2 proposes instructions one at a time, and Phase
 * 3 runs a single-concurrency effect-search TPE study seeded with a baseline
 * prior trial. The winning configuration is applied to and returns
 * `options.module`. Proposal failures use `InstructionProposalFailed`; search
 * setup or completion failures use `AllTrialsFailed`; module, metric, schema,
 * and language-model requirements remain visible in the Effect type.
 *
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al. (2024)}
 * @since 0.1.0
 * @category constructors
 */
export const miprov2WithEvents = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never
>(
  options: MIPROv2Options<I, O, ME, MR>,
  emit: MIPROv2EventSink
) =>
  Effect.gen(function*() {
    const optionBag: MIPROOptionLike<I, O, ME, MR> = options

    yield* emit(MIPROv2Event.Phase1Started({ numCandidates: options.numCandidates }))

    const demoCandidates = yield* generateDemoCandidates(toPhase1Options(optionBag))

    yield* emitPhase1Candidates(demoCandidates, emit)

    yield* emit(
      MIPROv2Event.Phase1Completed({
        totalCandidates: totalDemoCandidates(demoCandidates)
      })
    )

    yield* emit(MIPROv2Event.Phase2Started({ numInstructions: options.numInstructions }))

    const instructionCandidates = yield* proposeInstructionCandidates(toPhase2Options(optionBag, demoCandidates))

    yield* emitPhase2Candidates(instructionCandidates, emit)

    yield* emit(
      MIPROv2Event.Phase2Completed({
        totalInstructions: totalInstructionCandidates(instructionCandidates)
      })
    )

    const resolvedPhase3TrialBudget = resolvePhase3TrialBudget(optionBag, demoCandidates, instructionCandidates)

    yield* emit(MIPROv2Event.Phase3Started({ numTrials: resolvedPhase3TrialBudget }))

    const phase3 = yield* runPhase3Search(
      toPhase3Options(optionBag, emit, resolvedPhase3TrialBudget, demoCandidates, instructionCandidates)
    )

    yield* emit(
      MIPROv2Event.Phase3Completed({
        bestScore: phase3.diagnostics.bestScore,
        totalTrials: phase3.diagnostics.trialBudget
      })
    )

    return options.module
  })

/**
 * Run MIPROv2 and return the module with optimized instructions and
 * demonstrations.
 *
 * @since 0.1.0
 * @category constructors
 */
export const miprov2 = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never
>(
  options: MIPROv2Options<I, O, ME, MR>
) => miprov2WithEvents(options, noMIPROv2Events)

/**
 * Lazily run MIPROv2 and emit lifecycle events in phase/trial order. Consuming
 * the stream drives optimization; the optimized module is not emitted.
 *
 * @since 0.1.0
 * @category constructors
 */
export const miprov2Stream = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never
>(
  options: MIPROv2Options<I, O, ME, MR>
) => streamMIPROv2Events((emit) => miprov2WithEvents(options, emit))

export * from "./bootstrap.js"
export * from "./events.js"
export * from "./observability.js"
export * from "./progress.js"
export * from "./propose.js"
export * from "./search.js"
