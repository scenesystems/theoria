/** Pinned MIPROv2 compile defaults, validation, auto budgets, and phase options. @internal */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Chunk, Data, Effect, Match, Option, Struct } from "effect"
import type { Schema } from "effect"
import { MIPROv2Error } from "../../../DspError.js"
import type { Examples, Options } from "../../../MIPROv2.js"
import {
  GenerateDemoCandidatesOptions,
  type PredictorDemoCandidateSets,
  type PredictorInstructionCandidateSets,
  ProposeInstructionCandidatesOptions
} from "../../../MIPROv2Candidates.js"
import { type EventSink, Options as SearchOptions } from "../../../MIPROv2Search.js"
import { predictors } from "../../../ModuleGraph.js"
import * as Sampling from "../sampling.js"
import { phase3TrialBudget } from "./budget.js"

/** Resolved compile datasets and counts; source options carry generic module/metric services. @internal */
export class ResolvedOptions<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R>
  extends Data.Class<{
    readonly options: Options<I, O, ME, MR, E, R>
    readonly trainset: Examples
    readonly valset: Examples
    readonly numCandidates: number
    readonly numInstructions: number
    readonly numTrials: number
    readonly minibatch: boolean
    readonly zeroShot: boolean
  }>
{}

/** Split is deterministic; auto sampling is the first consumer of the shared RNG. @internal */
export const resolveOptions = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R>(
  options: Options<I, O, ME, MR, E, R>
) =>
  Effect.gen(function*() {
    const auto = options.auto ?? Option.some("light")
    const explicitCounts = Option.all([
      Option.fromUndefinedOr(options.numCandidates),
      Option.fromUndefinedOr(options.numTrials)
    ])
    yield* Effect.fail(
      new MIPROv2Error({
        reason: "invalid-options",
        message: "Auto requires omitted numCandidates and numTrials; explicit mode requires both."
      })
    ).pipe(
      Effect.when(Effect.succeed(
        Option.isSome(auto)
          ? Option.isSome(Option.fromUndefinedOr(options.numCandidates)) ||
            Option.isSome(Option.fromUndefinedOr(options.numTrials))
          : Option.isNone(explicitCounts)
      ))
    )
    const explicitValset = Option.fromUndefinedOr(options.valset)
    yield* Effect.fail(
      new MIPROv2Error({
        reason: "invalid-dataset",
        message: "Trainset cannot be empty; at least two examples are required without a valset."
      })
    ).pipe(
      Effect.when(
        Effect.succeed(options.trainset.length === 0 || (Option.isNone(explicitValset) && options.trainset.length < 2))
      )
    )
    const cutoff = options.trainset.length -
      Numeric.min(1000, Numeric.max(1, Numeric.floor(options.trainset.length * 0.8)))
    const trainset = Option.isSome(explicitValset) ? options.trainset : Arr.take(options.trainset, cutoff)
    const validation = Option.getOrElse(explicitValset, () => Arr.drop(options.trainset, cutoff))
    yield* Effect.fail(new MIPROv2Error({ reason: "invalid-dataset", message: "Valset cannot be empty." })).pipe(
      Effect.when(Effect.succeed(validation.length === 0))
    )
    const zeroShot = (options.maxBootstrappedDemos ?? 4) === 0 && (options.maxLabeledDemos ?? 4) === 0
    const selected = yield* Option.match(auto, {
      onNone: () =>
        Effect.fromOption(explicitCounts).pipe(Effect.map(([numCandidates, numTrials]) => ({
          valset: validation,
          numCandidates,
          numInstructions: numCandidates,
          numTrials,
          minibatch: options.minibatch ?? true
        }))),
      onSome: (mode) =>
        Effect.gen(function*() {
          const setting = Match.value(mode).pipe(
            Match.when("light", () => ({ candidates: 6, valSize: 100 })),
            Match.when("medium", () => ({ candidates: 12, valSize: 300 })),
            Match.when("heavy", () => ({ candidates: 18, valSize: 1000 })),
            Match.exhaustive
          )
          const rng = yield* Sampling.resolve(options.seed ?? 9)
          const valset = Arr.fromIterable(
            yield* rng.sample(Chunk.fromIterable(validation), Numeric.min(setting.valSize, validation.length))
          )
          const numInstructions = zeroShot ? setting.candidates : Numeric.floor(setting.candidates * 0.5)
          const numTrials = phase3TrialBudget({
            predictorCount: Arr.filter(Arr.fromIterable(predictors(options.module)), (predictor) =>
              !predictor.frozen).length,
            demoCandidateCount: zeroShot ? 0 : setting.candidates,
            instructionCandidateCount: numInstructions
          })
          return {
            valset,
            numCandidates: setting.candidates,
            numInstructions,
            numTrials,
            minibatch: valset.length > 50
          }
        })
    })
    yield* Effect.fail(
      new MIPROv2Error({ reason: "invalid-options", message: "minibatchSize cannot exceed the validation set size." })
    ).pipe(
      Effect.when(Effect.succeed(selected.minibatch && (options.minibatchSize ?? 35) > selected.valset.length))
    )
    return new ResolvedOptions({ options, trainset, zeroShot, ...selected })
  })

/** @internal */
export const toPhase1Options = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R>(
  resolved: ResolvedOptions<I, O, ME, MR, E, R>
) =>
  new GenerateDemoCandidatesOptions(Struct.assign(resolved.options, {
    trainset: resolved.trainset,
    numCandidates: resolved.numCandidates,
    seed: resolved.options.seed ?? 9,
    maxLabeledDemos: resolved.options.maxLabeledDemos ?? 4,
    maxBootstrappedDemos: resolved.options.maxBootstrappedDemos ?? 4,
    metricThreshold: resolved.options.metricThreshold ?? Option.none(),
    maxErrors: resolved.options.maxErrors ?? Option.none()
  }))

/** @internal */
export const toPhase2Options = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R>(
  resolved: ResolvedOptions<I, O, ME, MR, E, R>,
  demoCandidates: PredictorDemoCandidateSets
) =>
  new ProposeInstructionCandidatesOptions(Struct.assign(resolved.options, {
    trainset: resolved.trainset,
    demoCandidates,
    numInstructions: resolved.numInstructions,
    seed: resolved.options.seed ?? 9,
    initTemperature: resolved.options.initTemperature ?? 1,
    programAwareProposer: resolved.options.programAwareProposer ?? true,
    dataAwareProposer: resolved.options.dataAwareProposer ?? true,
    tipAwareProposer: resolved.options.tipAwareProposer ?? true,
    fewshotAwareProposer: resolved.options.fewshotAwareProposer ?? true,
    viewDataBatchSize: resolved.options.viewDataBatchSize ?? 10
  }))

/** @internal */
export const toPhase3Options = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R, EE, ER>(
  resolved: ResolvedOptions<I, O, ME, MR, E, R>,
  emit: EventSink<EE, ER>,
  demoCandidates: PredictorDemoCandidateSets,
  instructionCandidates: PredictorInstructionCandidateSets
) =>
  new SearchOptions(Struct.assign(resolved.options, {
    valset: resolved.valset,
    demoCandidates,
    instructionCandidates,
    emit,
    trialBudget: resolved.numTrials,
    minibatch: resolved.minibatch,
    minibatchSize: resolved.options.minibatchSize ?? 35,
    fullEvalEvery: resolved.options.minibatchFullEvalSteps ?? 5,
    seed: resolved.options.seed ?? 9
  }))
