/**
 * COPRO runtime.
 *
 * @since 0.2.0
 * @internal
 */
import type * as LanguageModel from "@effect/ai/LanguageModel"
import { Array as Arr, Effect, Match, Option, Ref } from "effect"
import type { Context, Schema } from "effect"
import { normalizeDeterministicSeed } from "../../../contracts/DeterministicSeed.js"
import { withModuleParamsInstructions } from "../../../contracts/ModuleParams.js"
import { projectSingleObjective } from "../../../contracts/ObjectiveProjection.js"
import * as Evaluate from "../../../Evaluate/index.js"
import type { Example } from "../../../Example/index.js"
import { collectModuleParamRefs, type ModuleParamRef } from "../../../internal/module-params.js"
import * as Module from "../../../Module/index.js"
import { COPROEvent } from "../events.js"
import type { COPROEventSink, COPROOptions } from "../model.js"
import { COPROAcceptedUpdate, COPRORecordedTrial, COPROSnapshot } from "../snapshot.js"
import { proposeRefinedInstruction, proposeSeedInstruction } from "./proposal.js"

type RuntimeState = Readonly<{
  readonly nextStep: number
  readonly nextTrialNumber: number
  readonly bestScore: number
  readonly trials: ReadonlyArray<COPRORecordedTrial>
  readonly acceptedUpdates: ReadonlyArray<COPROAcceptedUpdate>
}>

const candidateSlots = (numCandidates: number): ReadonlyArray<number> =>
  Arr.makeBy(Math.max(1, Math.trunc(numCandidates)), (index) => index)

const resolveValset = (options: {
  readonly trainset: ReadonlyArray<Example>
  readonly valset?: ReadonlyArray<Example>
}) => Option.getOrElse(Option.fromNullable(options.valset), () => options.trainset)

const attemptHistory = (trials: ReadonlyArray<COPRORecordedTrial>, predictorName: string): string =>
  [...trials.filter((trial) => trial.predictorName === predictorName)]
    .sort((left: COPRORecordedTrial, right: COPRORecordedTrial) =>
      left.score - right.score || left.trialNumber - right.trialNumber
    )
    .map((trial, index) =>
      `Instruction #${index + 1}: ${trial.instruction}\nResulting Score #${index + 1}: ${trial.score}`
    )
    .join("\n")

const singleObjectiveScore = (objective: number | ReadonlyArray<number>): number =>
  Match.value(objective).pipe(
    Match.when(Match.number, (score) => score),
    Match.orElse((scores) => scores[0] ?? 0)
  )

const currentInstruction = (ref: ModuleParamRef) =>
  Ref.get(ref.params).pipe(Effect.map((params) => params.instructions))

const setInstruction = (ref: ModuleParamRef, instruction: string) =>
  Ref.update(ref.params, (params) => withModuleParamsInstructions(params, instruction))

const evaluateModuleScore = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR,
  R
>(
  options: COPROOptions<I, O, ME, MR>,
  evaluationContext: Context.Context<R>
) =>
  Evaluate.run({
    module: options.module,
    examples: resolveValset(options),
    metrics: { copro: options.metric },
    concurrency: 1
  }).pipe(
    Effect.provide(evaluationContext),
    Effect.flatMap((report) => projectSingleObjective(report, "copro")),
    Effect.map((projection) => singleObjectiveScore(projection.objective))
  )

const makeSnapshot = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(options: {
  readonly module: Module.Module<I, O>
  readonly baselineInstruction: string
  readonly numCandidates: number
  readonly maxSteps: number
  readonly seed: number
  readonly completionReason: COPROSnapshot["completionReason"]
  readonly state: RuntimeState
}) =>
  Effect.gen(function*() {
    const moduleState = yield* Module.save(options.module)
    const rootParams = yield* Ref.get(options.module.params)

    return new COPROSnapshot({
      snapshotFormatVersion: 1,
      moduleName: options.module.name,
      moduleState,
      numCandidates: options.numCandidates,
      maxSteps: options.maxSteps,
      nextStep: options.state.nextStep,
      nextTrialNumber: options.state.nextTrialNumber,
      seed: options.seed,
      baselineInstruction: options.baselineInstruction,
      bestInstruction: rootParams.instructions,
      bestScore: options.state.bestScore,
      completionReason: options.completionReason,
      trials: options.state.trials,
      acceptedUpdates: options.state.acceptedUpdates
    })
  })

const buildCandidates = (options: {
  readonly predictorName: string
  readonly currentInstruction: string
  readonly attempts: string
  readonly step: number
  readonly numCandidates: number
  readonly temperature: Option.Option<number>
}) =>
  Effect.forEach(candidateSlots(options.numCandidates), (candidateIndex) =>
    candidateIndex === 0
      ? Effect.succeed(options.currentInstruction)
      : Match.value(options.step).pipe(
        Match.when(0, () => proposeSeedInstruction({ ...options, candidateIndex })),
        Match.orElse(() => proposeRefinedInstruction({ ...options, candidateIndex }))
      ))

const runPredictorStep = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR,
  R
>(options: {
  readonly state: RuntimeState
  readonly predictor: ModuleParamRef
  readonly copro: COPROOptions<I, O, ME, MR>
  readonly emit: COPROEventSink
  readonly evaluationContext: Context.Context<R>
  readonly temperature: Option.Option<number>
}) =>
  Effect.gen(function*() {
    const instructionBeforeStep = yield* currentInstruction(options.predictor)
    const candidates = yield* buildCandidates({
      predictorName: options.predictor.name,
      currentInstruction: instructionBeforeStep,
      attempts: attemptHistory(options.state.trials, options.predictor.name),
      step: options.state.nextStep,
      numCandidates: options.copro.numCandidates,
      temperature: options.temperature
    })
    const evaluation = yield* Effect.reduce(candidates, options.state, (state, instruction, candidateIndex) =>
      Effect.gen(function*() {
        yield* options.emit(
          COPROEvent.InstructionCandidateProposed({
            step: state.nextStep,
            predictorName: options.predictor.name,
            candidateIndex,
            instruction
          })
        )
        yield* setInstruction(options.predictor, instruction)
        const score = yield* evaluateModuleScore(options.copro, options.evaluationContext)
        const improved = score > state.bestScore
        yield* options.emit(
          COPROEvent.TrialEvaluated({
            step: state.nextStep,
            predictorName: options.predictor.name,
            trialNumber: state.nextTrialNumber,
            candidateIndex,
            score,
            improved
          })
        )

        return {
          ...state,
          nextTrialNumber: state.nextTrialNumber + 1,
          bestScore: Math.max(state.bestScore, score),
          trials: Arr.append(
            state.trials,
            new COPRORecordedTrial({
              trialNumber: state.nextTrialNumber,
              step: state.nextStep,
              predictorName: options.predictor.name,
              candidateIndex,
              instruction,
              score,
              improved
            })
          )
        }
      }))
    const predictorTrials = evaluation.trials.filter((trial) =>
      trial.step === evaluation.nextStep && trial.predictorName === options.predictor.name
    )
    const bestTrial = Arr.reduce(
      predictorTrials,
      predictorTrials[0]!,
      (best, trial) => (trial.score > best.score ? trial : best)
    )
    const changed = bestTrial.instruction !== instructionBeforeStep
    yield* setInstruction(options.predictor, bestTrial.instruction)
    yield* options.emit(
      COPROEvent.PredictorUpdated({
        step: evaluation.nextStep,
        predictorName: options.predictor.name,
        instruction: bestTrial.instruction,
        score: bestTrial.score,
        changed
      })
    )

    return {
      changed,
      state: {
        ...evaluation,
        acceptedUpdates: Arr.append(
          evaluation.acceptedUpdates,
          new COPROAcceptedUpdate({
            step: evaluation.nextStep,
            predictorName: options.predictor.name,
            instruction: bestTrial.instruction,
            score: bestTrial.score,
            changed
          })
        )
      }
    }
  })

export const runCOPRO = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME = never, MR = never>(
  options: COPROOptions<I, O, ME, MR>,
  emit: COPROEventSink
) =>
  Effect.gen(function*() {
    const evaluationContext = yield* Effect.context<
      | LanguageModel.LanguageModel
      | MR
      | Schema.Schema.Context<Schema.Struct<I>>
      | Schema.Schema.Context<Schema.Struct<O>>
    >()
    const seed = normalizeDeterministicSeed(Option.getOrElse(Option.fromNullable(options.seed), () => 17))
    const predictors = collectModuleParamRefs(options.module)
    const baselineInstruction = yield* currentInstruction(predictors[0]!)
    const initialState = Option.match(Option.fromNullable(options.resumeFrom), {
      onNone: () => ({
        nextStep: 0,
        nextTrialNumber: 0,
        bestScore: 0,
        trials: Arr.empty<COPRORecordedTrial>(),
        acceptedUpdates: Arr.empty<COPROAcceptedUpdate>()
      }),
      onSome: (snapshot) => ({
        nextStep: snapshot.nextStep,
        nextTrialNumber: snapshot.nextTrialNumber,
        bestScore: snapshot.bestScore,
        trials: snapshot.trials,
        acceptedUpdates: snapshot.acceptedUpdates
      })
    })
    yield* Option.match(Option.fromNullable(options.resumeFrom), {
      onNone: () => Effect.void,
      onSome: (snapshot) => Module.load(options.module, snapshot.moduleState)
    })
    const startingScore = yield* evaluateModuleScore(options, evaluationContext)
    const seededState = { ...initialState, bestScore: Math.max(initialState.bestScore, startingScore) }
    const temperature = Option.fromNullable(options.initTemperature)

    yield* emit(
      COPROEvent.OptimizationStarted({
        maxSteps: options.maxSteps,
        numCandidates: options.numCandidates,
        resumedFromSnapshot: Option.isSome(Option.fromNullable(options.resumeFrom)),
        nextStep: seededState.nextStep
      })
    )

    const finalState = yield* Effect.iterate(seededState, {
      while: (state) => state.nextStep < options.maxSteps,
      body: (state) =>
        Effect.gen(function*() {
          yield* emit(COPROEvent.StepStarted({ step: state.nextStep }))
          const reduced = yield* Effect.reduce(predictors, { state, changedCount: 0 }, (accumulator, predictor) =>
            runPredictorStep({
              state: accumulator.state,
              predictor,
              copro: options,
              emit,
              evaluationContext,
              temperature
            }).pipe(
              Effect.map((result) => ({
                state: result.state,
                changedCount: accumulator.changedCount + (result.changed ? 1 : 0)
              }))
            ))
          const stepScore = yield* evaluateModuleScore(options, evaluationContext)
          const nextStep = reduced.changedCount === 0 ? options.maxSteps : reduced.state.nextStep + 1
          const nextState = { ...reduced.state, nextStep, bestScore: Math.max(reduced.state.bestScore, stepScore) }

          yield* emit(
            COPROEvent.StepCompleted({
              step: state.nextStep,
              bestScore: stepScore,
              changedPredictorCount: reduced.changedCount
            })
          )
          yield* Option.match(Option.fromNullable(options.snapshotSink), {
            onNone: () => Effect.void,
            onSome: (snapshotSink) =>
              makeSnapshot({
                module: options.module,
                baselineInstruction,
                numCandidates: options.numCandidates,
                maxSteps: options.maxSteps,
                seed,
                completionReason: nextStep >= options.maxSteps ? "budgetExhausted" : "interrupted",
                state: nextState
              }).pipe(Effect.flatMap(snapshotSink))
          })

          return nextState
        })
    })

    yield* emit(
      COPROEvent.OptimizationCompleted({
        stepsCompleted: finalState.nextStep,
        totalTrials: finalState.trials.length,
        bestScore: finalState.bestScore
      })
    )
    return options.module
  })
