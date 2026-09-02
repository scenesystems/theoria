/**
 * Searches labeled demonstration subsets and generated instructions in three
 * ordered phases.
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
export type MIPROv2Options<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never
> = Readonly<{
  /** Module tree mutated during evaluation and left with the selected configuration on success. */
  readonly module: DspModule<I, O>
  /** Examples used for proposal context; only entries with `output` become demonstrations. */
  readonly trainset: ReadonlyArray<Example>
  /** Phase 3 evaluation set. Defaults to `trainset`; no automatic split is performed. */
  readonly valset?: ReadonlyArray<Example>
  /** Single objective used for baseline, minibatch, and full-set evaluations. */
  readonly metric: Metric<ME, MR>
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
  readonly tipVocabulary?: ReadonlyArray<string>
  /** Phase 3 study trials; invalid counts become one and omission uses {@link phase3TrialBudget}. */
  readonly trialBudget?: number
  /** Prefix size of `valset` used for every trial objective. Defaults to `50` and is normalized to a positive integer. */
  readonly minibatchSize?: number
  /** Trial cadence for diagnostic full-set evaluations. Defaults to `5` and is normalized to a positive integer. */
  readonly fullEvalEvery?: number
}>

/**
 * Receives lifecycle events in execution order. The optimizer waits for each
 * returned Effect before continuing.
 *
 * @since 0.1.0
 * @category models
 */
export type MIPROv2EventSink = (event: MIPROv2EventType) => Effect.Effect<void>

/**
 * Discards lifecycle events without adding a failure or service requirement.
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
 * Runs all MIPROv2 phases and reports their lifecycle events.
 *
 * @remarks
 * Phase 1 snapshots every owned predictor and builds candidates from labeled
 * examples. Phase 2 asks the configured language model for alternatives in
 * predictor order. Phase 3 evaluates a baseline, then runs a single-concurrency
 * TPE study whose trial objective uses the leading validation-set minibatch.
 * Periodic full-set evaluations update diagnostics without changing the TPE
 * objective or selected trial.
 *
 * The selected instruction and demonstration indexes are written to the same
 * module instance. Search evaluation mutates parameter refs as it runs, so a
 * failure or interruption can leave the most recently applied configuration in
 * place. Instruction generation failures become `InstructionProposalFailed`.
 * Candidate mismatch, search-space, and study-completion failures become
 * `AllTrialsFailed`. Module, metric, Schema, and language-model failures that
 * occur before the study retain their declared error channels.
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
export const miprov2 = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never
>(
  options: MIPROv2Options<I, O, ME, MR>
) => miprov2WithEvents(options, noMIPROv2Events)

/**
 * Emits lifecycle events while stream consumption drives one MIPROv2 run.
 *
 * @remarks
 * The stream ends after `Phase3Completed`. It contains events only; use
 * {@link miprov2WithEvents} when the caller also needs the returned module.
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
