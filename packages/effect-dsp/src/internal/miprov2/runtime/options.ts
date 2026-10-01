/**
 * MIPROv2 option adapters — normalizes user-facing options into
 * phase-specific configurations.
 *
 * @since 0.1.0
 * @internal
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Option } from "effect"
import type { Schema } from "effect"
import type { Options } from "../../../MIPROv2.js"
import {
  GenerateDemoCandidatesOptions,
  type PredictorDemoCandidateSets,
  type PredictorInstructionCandidateSets,
  ProposeInstructionCandidatesOptions
} from "../../../MIPROv2Candidates.js"
import { Options as SearchOptions } from "../../../MIPROv2Search.js"
import { phase3TrialBudget } from "./budget.js"

/**
 * Canonical internal alias for the user-facing MIPROv2 options.
 *
 * Phase-specific adapter functions project the public model down to exactly
 * the options each phase requires without duplicating its data contract.
 *
 * @since 0.1.0
 * @category models
 * @see {@link toPhase1Options} — demo-bootstrap projection
 * @see {@link toPhase2Options} — instruction-proposal projection
 * @see {@link toPhase3Options} — search projection
 */
export type MIPROOptionLike<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR,
  E,
  R
> = Options<I, O, ME, MR, E, R>

const maxDemoCandidateCount = (candidateSets: PredictorDemoCandidateSets): number =>
  Arr.reduce(
    candidateSets,
    1,
    (currentMax, candidateSet) => Numeric.max(currentMax, Arr.length(candidateSet.candidates))
  )

const maxInstructionCandidateCount = (candidateSets: PredictorInstructionCandidateSets): number =>
  Arr.reduce(
    candidateSets,
    1,
    (currentMax, candidateSet) => Numeric.max(currentMax, Arr.length(candidateSet.candidates))
  )

/**
 * Returns the explicit validation set when provided, falling back to the
 * training set otherwise.
 *
 * @since 0.1.0
 * @category helpers
 */
export const resolveValset = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R>(
  options: MIPROOptionLike<I, O, ME, MR, E, R>
) => Option.getOrElse(Option.fromNullable(options.valset), () => options.trainset)

/**
 * Determines how many Phase 3 trials to run.
 *
 * Uses the explicit `trialBudget` when the caller supplied one,
 * otherwise computes a budget from the number of predictors and the
 * largest demo / instruction candidate set via `phase3TrialBudget`.
 *
 * @since 0.1.0
 * @category helpers
 */
export const resolvePhase3TrialBudget = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR,
  E,
  R
>(
  options: MIPROOptionLike<I, O, ME, MR, E, R>,
  demoCandidates: PredictorDemoCandidateSets,
  instructionCandidates: PredictorInstructionCandidateSets
): number =>
  Option.getOrElse(
    Option.fromNullable(options.trialBudget),
    () =>
      phase3TrialBudget({
        predictorCount: Arr.length(demoCandidates),
        demoCandidateCount: maxDemoCandidateCount(demoCandidates),
        instructionCandidateCount: maxInstructionCandidateCount(instructionCandidates)
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
 * @since 0.1.0
 * @category helpers
 * @see {@link MIPROOptionLike}
 */
export const toPhase1Options = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR,
  E,
  R
>(
  options: MIPROOptionLike<I, O, ME, MR, E, R>
): GenerateDemoCandidatesOptions<I, O, E, R> =>
  new GenerateDemoCandidatesOptions({
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
 * @since 0.1.0
 * @category helpers
 * @see {@link MIPROOptionLike}
 */
export const toPhase2Options = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR,
  E,
  R
>(
  options: MIPROOptionLike<I, O, ME, MR, E, R>,
  demoCandidates: PredictorDemoCandidateSets
): ProposeInstructionCandidatesOptions<I, O, E, R> =>
  new ProposeInstructionCandidatesOptions({
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
 * @since 0.1.0
 * @category helpers
 * @see {@link MIPROOptionLike}
 */
export const toPhase3Options = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR,
  E,
  R,
  EE,
  ER
>(
  options: MIPROOptionLike<I, O, ME, MR, E, R>,
  emit: SearchOptions<I, O, ME, MR, E, R, EE, ER>["emit"],
  trialBudget: number,
  demoCandidates: PredictorDemoCandidateSets,
  instructionCandidates: PredictorInstructionCandidateSets
): SearchOptions<I, O, ME, MR, E, R, EE, ER> =>
  new SearchOptions({
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
