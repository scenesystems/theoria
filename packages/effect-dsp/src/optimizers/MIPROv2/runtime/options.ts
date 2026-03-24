/**
 * MIPROv2 option adapters — normalizes user-facing options into
 * phase-specific configurations.
 *
 * @since 0.0.0
 * @internal
 */
import { Array as Arr, Option } from "effect"
import type { Schema } from "effect"
import type { Example } from "../../../Example/index.js"
import type { Metric } from "../../../Metric/model.js"
import type { Module as DspModule } from "../../../Module/model.js"
import type { GenerateDemoCandidatesOptions, PredictorDemoCandidates } from "../bootstrap.js"
import type { RunPhase3SearchOptions } from "../phase3-model.js"
import type { PredictorInstructionCandidates, ProposeInstructionCandidatesOptions } from "../propose.js"
import { phase3TrialBudget } from "./budget.js"

/**
 * Superset of every user-configurable knob accepted by the MIPROv2
 * optimizer.
 *
 * Optional fields carry sensible defaults when omitted. Phase-specific
 * adapter functions (`toPhase1Options`, `toPhase2Options`,
 * `toPhase3Options`) project this superset down to exactly the options
 * each phase requires.
 *
 * @since 0.0.0
 * @category models
 * @see {@link toPhase1Options} — demo-bootstrap projection
 * @see {@link toPhase2Options} — instruction-proposal projection
 * @see {@link toPhase3Options} — search projection
 */
export type MIPROOptionLike<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR
> = Readonly<{
  readonly module: DspModule<I, O>
  readonly trainset: ReadonlyArray<Example>
  readonly valset?: ReadonlyArray<Example>
  readonly metric: Metric<ME, MR>
  readonly numCandidates: number
  readonly numInstructions: number
  readonly seed?: number
  readonly maxLabeledDemos?: number
  readonly maxBootstrappedDemos?: number
  readonly diversityTemperature?: number
  readonly tipVocabulary?: ReadonlyArray<string>
  readonly trialBudget?: number
  readonly minibatchSize?: number
  readonly fullEvalEvery?: number
}>

const maxCandidateCount = <Candidate>(
  candidateSets: ReadonlyArray<Readonly<{ readonly candidates: ReadonlyArray<Candidate> }>>
): number =>
  Arr.reduce(candidateSets, 1, (currentMax, candidateSet) => Math.max(currentMax, candidateSet.candidates.length))

/**
 * Returns the explicit validation set when provided, falling back to the
 * training set otherwise.
 *
 * @since 0.0.0
 * @category helpers
 */
export const resolveValset = (
  options: { readonly trainset: ReadonlyArray<Example>; readonly valset?: ReadonlyArray<Example> }
): ReadonlyArray<Example> => Option.getOrElse(Option.fromNullable(options.valset), () => options.trainset)

/**
 * Determines how many Phase 3 trials to run.
 *
 * Uses the explicit `trialBudget` when the caller supplied one,
 * otherwise computes a budget from the number of predictors and the
 * largest demo / instruction candidate set via `phase3TrialBudget`.
 *
 * @since 0.0.0
 * @category helpers
 */
export const resolvePhase3TrialBudget = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR
>(
  options: MIPROOptionLike<I, O, ME, MR>,
  demoCandidates: ReadonlyArray<PredictorDemoCandidates>,
  instructionCandidates: ReadonlyArray<PredictorInstructionCandidates>
): number =>
  Option.getOrElse(
    Option.fromNullable(options.trialBudget),
    () =>
      phase3TrialBudget({
        predictorCount: demoCandidates.length,
        demoCandidateCount: maxCandidateCount(demoCandidates),
        instructionCandidateCount: maxCandidateCount(instructionCandidates)
      })
  )

/**
 * Projects `MIPROOptionLike` into the options required by Phase 1
 * (demo candidate bootstrap).
 *
 * Carries `module`, `trainset`, `numCandidates`, and any optional
 * bootstrap-specific knobs (`seed`, `maxLabeledDemos`,
 * `maxBootstrappedDemos`).
 *
 * @since 0.0.0
 * @category helpers
 * @see {@link MIPROOptionLike}
 */
export const toPhase1Options = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR
>(
  options: MIPROOptionLike<I, O, ME, MR>
): GenerateDemoCandidatesOptions<I, O> => ({
  module: options.module,
  trainset: options.trainset,
  numCandidates: options.numCandidates,
  ...Option.match(Option.fromNullable(options.seed), {
    onNone: () => ({}),
    onSome: (seed) => ({ seed })
  }),
  ...Option.match(Option.fromNullable(options.maxLabeledDemos), {
    onNone: () => ({}),
    onSome: (maxLabeledDemos) => ({ maxLabeledDemos })
  }),
  ...Option.match(Option.fromNullable(options.maxBootstrappedDemos), {
    onNone: () => ({}),
    onSome: (maxBootstrappedDemos) => ({ maxBootstrappedDemos })
  })
})

/**
 * Projects `MIPROOptionLike` into the options required by Phase 2
 * (instruction candidate proposal).
 *
 * Carries `module`, `trainset`, `demoCandidates`, `numInstructions`,
 * and any optional proposal-specific knobs (`seed`,
 * `diversityTemperature`, `tipVocabulary`).
 *
 * @since 0.0.0
 * @category helpers
 * @see {@link MIPROOptionLike}
 */
export const toPhase2Options = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR
>(
  options: MIPROOptionLike<I, O, ME, MR>,
  demoCandidates: ReadonlyArray<PredictorDemoCandidates>
): ProposeInstructionCandidatesOptions<I, O> => ({
  module: options.module,
  trainset: options.trainset,
  demoCandidates,
  numInstructions: options.numInstructions,
  ...Option.match(Option.fromNullable(options.seed), {
    onNone: () => ({}),
    onSome: (seed) => ({ seed })
  }),
  ...Option.match(Option.fromNullable(options.diversityTemperature), {
    onNone: () => ({}),
    onSome: (diversityTemperature) => ({ diversityTemperature })
  }),
  ...Option.match(Option.fromNullable(options.tipVocabulary), {
    onNone: () => ({}),
    onSome: (tipVocabulary) => ({ tipVocabulary })
  })
})

/**
 * Projects `MIPROOptionLike` into the options required by Phase 3
 * (Bayesian search).
 *
 * Resolves the validation set and forwards `metric`, `trialBudget`,
 * candidate sets, and any optional search-specific knobs
 * (`minibatchSize`, `fullEvalEvery`, `seed`, `emit`).
 *
 * @since 0.0.0
 * @category helpers
 * @see {@link MIPROOptionLike}
 */
export const toPhase3Options = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR
>(
  options: MIPROOptionLike<I, O, ME, MR>,
  emit: RunPhase3SearchOptions<I, O, ME, MR>["emit"],
  trialBudget: number,
  demoCandidates: ReadonlyArray<PredictorDemoCandidates>,
  instructionCandidates: ReadonlyArray<PredictorInstructionCandidates>
): RunPhase3SearchOptions<I, O, ME, MR> => ({
  module: options.module,
  valset: resolveValset(options),
  metric: options.metric,
  trialBudget,
  demoCandidates,
  instructionCandidates,
  ...Option.match(Option.fromNullable(options.minibatchSize), {
    onNone: () => ({}),
    onSome: (minibatchSize) => ({ minibatchSize })
  }),
  ...Option.match(Option.fromNullable(options.fullEvalEvery), {
    onNone: () => ({}),
    onSome: (fullEvalEvery) => ({ fullEvalEvery })
  }),
  ...Option.match(Option.fromNullable(options.seed), {
    onNone: () => ({}),
    onSome: (seed) => ({ seed })
  }),
  ...Option.match(Option.fromNullable(emit), {
    onNone: () => ({}),
    onSome: (phase3Emit) => ({ emit: phase3Emit })
  })
})
