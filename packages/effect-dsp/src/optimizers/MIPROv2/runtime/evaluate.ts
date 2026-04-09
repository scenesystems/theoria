/**
 * Phase 3 trial evaluation — applies instruction/demo configurations and
 * scores against the validation set.
 *
 * @since 0.1.0
 * @internal
 */
import { Array as Arr, Data, Effect, Option, Ref } from "effect"
import { Study } from "effect-search"
import { withModuleParamsDemosAndInstructions } from "../../../contracts/ModuleParams.js"
import { AllTrialsFailed } from "../../../Errors/optimizer.js"
import type { Example } from "../../../Example/index.js"
import { MIPROv2Event } from "../events.js"
import type { Phase3EventSink } from "../phase3-model.js"
import {
  BestAveragingCandidate,
  demoDimensionName,
  instructionDimensionName,
  type Phase3Config,
  type PredictorBinding
} from "./model.js"
import { configIndex } from "./search-space.js"
import type { Phase3TrialRefs } from "./trialRefs.js"

/**
 * Writes the instruction and demo candidates selected by a trial
 * configuration into each predictor's mutable `Ref`.
 *
 * For every binding the corresponding demo and instruction indices are
 * looked up from the config record and the matching candidates are
 * resolved. Fails with `AllTrialsFailed` when an index is out of
 * range for any predictor.
 *
 * @since 0.1.0
 * @category combinators
 * @see {@link evaluateTrial} — calls this before scoring
 */
export const applyPhase3Config = (options: {
  readonly config: Phase3Config
  readonly bindings: ReadonlyArray<PredictorBinding>
  readonly trialBudget: number
}) =>
  Effect.forEach(options.bindings, (binding) =>
    Effect.gen(function*() {
      const demoIndex = yield* configIndex(options.config, demoDimensionName(binding.predictorName))
      const instructionIndex = yield* configIndex(options.config, instructionDimensionName(binding.predictorName))
      const demo = yield* Option.match(Arr.get(binding.demos.candidates, demoIndex), {
        onNone: () =>
          Effect.fail(
            new AllTrialsFailed({
              message: `Missing demo candidate index ${demoIndex} for predictor '${binding.predictorName}'`,
              trialCount: options.trialBudget
            })
          ),
        onSome: (candidate) => Effect.succeed(candidate)
      })
      const instruction = yield* Option.match(Arr.get(binding.instructions.candidates, instructionIndex), {
        onNone: () =>
          Effect.fail(
            new AllTrialsFailed({
              message:
                `Missing instruction candidate index ${instructionIndex} for predictor '${binding.predictorName}'`,
              trialCount: options.trialBudget
            })
          ),
        onSome: (candidate) => Effect.succeed(candidate)
      })

      return yield* Ref.set(
        binding.paramsRef,
        withModuleParamsDemosAndInstructions(demo.params, demo.params.demos, instruction.instruction)
      )
    }), { discard: true })

/**
 * Scores the baseline (all index-0) configuration on the **full**
 * validation set before the Bayesian search begins.
 *
 * Returns the baseline objective score together with a `PriorTrial`
 * suitable for warm-starting the study. Also seeds the running-best
 * refs so that subsequent trials have a meaningful comparison
 * baseline.
 *
 * @since 0.1.0
 * @category combinators
 * @see {@link evaluateTrial} — per-trial counterpart
 */
export const evaluateBaseline = <E, R>(options: {
  readonly baselineConfig: Phase3Config
  readonly valset: ReadonlyArray<Example>
  readonly refs: Phase3TrialRefs
  readonly evaluateOn: (config: Phase3Config, examples: ReadonlyArray<Example>) => Effect.Effect<number, E, R>
}) =>
  Effect.gen(function*() {
    const baselineObjective = yield* options.evaluateOn(options.baselineConfig, options.valset)
    const priorTrial = new Study.PriorTrial<Phase3Config>({
      config: options.baselineConfig,
      value: baselineObjective
    })

    yield* Ref.set(options.refs.bestScoreRef, baselineObjective)
    yield* Ref.set(
      options.refs.bestAveragingRef,
      Option.some(new BestAveragingCandidate({ config: options.baselineConfig, score: baselineObjective }))
    )

    return {
      baselineObjective,
      priorTrial
    }
  })

/**
 * Runs a single Bayesian-search trial.
 *
 * **Minibatch scoring** — evaluates the given config on a minibatch
 * sample and updates the best-averaging candidate when the new score
 * is equal or better.
 *
 * **Full-eval checkpoint** — every `fullEvalEvery` trials the current
 * best-averaging config is re-scored on the full validation set and
 * the running-best score is updated accordingly.
 *
 * Emits `TrialEvaluated` after every minibatch and `FullEvalCompleted`
 * after each checkpoint.
 *
 * @since 0.1.0
 * @category combinators
 * @see {@link evaluateBaseline} — warm-start counterpart
 * @see {@link Phase3TrialRefs} — mutable state consumed here
 */
export const evaluateTrial = <E, R>(options: {
  readonly config: Phase3Config
  readonly refs: Phase3TrialRefs
  readonly minibatchExamples: ReadonlyArray<Example>
  readonly valset: ReadonlyArray<Example>
  readonly fullEvalEvery: number
  readonly emit: Phase3EventSink
  readonly evaluateOn: (config: Phase3Config, examples: ReadonlyArray<Example>) => Effect.Effect<number, E, R>
}) =>
  Effect.gen(function*() {
    const trial = yield* Ref.modify(options.refs.trialCounter, (count) => Data.tuple(count, count + 1))
    const checkpointCandidate = yield* Ref.modify(options.refs.bestAveragingRef, (current) => {
      const next = Option.match(current, {
        onNone: () =>
          Option.some(new BestAveragingCandidate({ config: options.config, score: Number.NEGATIVE_INFINITY })),
        onSome: (candidate) => Option.some(candidate)
      })

      return Data.tuple(
        Option.getOrElse(next, () =>
          new BestAveragingCandidate({ config: options.config, score: Number.NEGATIVE_INFINITY })),
        next
      )
    })
    const score = yield* options.evaluateOn(options.config, options.minibatchExamples)
    const bestCheckpointCandidate = yield* Ref.modify(options.refs.bestAveragingRef, (current) => {
      const next = Option.match(current, {
        onNone: () =>
          Option.some(new BestAveragingCandidate({ config: options.config, score })),
        onSome: (candidate) =>
          score >= candidate.score
            ? Option.some(new BestAveragingCandidate({ config: options.config, score }))
            : Option.some(candidate)
      })

      return Data.tuple(
        Option.getOrElse(next, () => checkpointCandidate),
        next
      )
    })

    yield* Ref.update(options.refs.bestScoreRef, (current) => Math.max(current, score))
    yield* Ref.update(options.refs.minibatchTrialsRef, (trials) => Arr.append(trials, trial))
    yield* options.emit(MIPROv2Event.TrialEvaluated({ trial, score }))

    yield* Effect.if((trial + 1) % options.fullEvalEvery === 0, {
      onTrue: () =>
        options.evaluateOn(bestCheckpointCandidate.config, options.valset).pipe(
          Effect.flatMap((fullEvalScore) =>
            Ref.modify(options.refs.bestScoreRef, (current) => {
              const next = Math.max(current, fullEvalScore)

              return Data.tuple(next, next)
            }).pipe(
              Effect.tap(() => Ref.update(options.refs.fullEvalTrialsRef, (trials) => Arr.append(trials, trial))),
              Effect.tap((updatedBestScore) =>
                options.emit(MIPROv2Event.FullEvalCompleted({ bestScore: updatedBestScore }))
              ),
              Effect.asVoid
            )
          )
        ),
      onFalse: () => Effect.void
    })

    return score
  })
