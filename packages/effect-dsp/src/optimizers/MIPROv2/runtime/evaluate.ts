/**
 * Phase 3 trial evaluation — applies instruction/demo configurations and
 * scores against the validation set.
 *
 * @since 0.1.0
 * @internal
 */
import { Study } from "@scenesystems/effect-search"
import {
  Array as Arr,
  Boolean as Bool,
  Data,
  Effect,
  Inspectable,
  Number as Num,
  Option,
  Ref,
  Schema,
  String as Str,
  Tuple
} from "effect"
import { withModuleParamsDemosAndInstructions } from "../../../contracts/ModuleParams.js"
import { AllTrialsFailed } from "../../../Errors/optimizer.js"
import { MIPROv2Event } from "../events.js"
import type { MIPROExamples } from "../index.js"
import type { Phase3EventSink } from "../phase3-model.js"
import {
  BestAveragingCandidate,
  demoDimensionName,
  instructionDimensionName,
  Phase3Config,
  type PredictorBinding
} from "./model.js"
import { configIndex } from "./search-space.js"

/**
 * **Mutable state** carried across the Bayesian search loop.
 *
 * Bundles the `Ref` cells that `evaluateTrial` reads and writes on every
 * iteration — trial counter, running-best score, the best-averaging
 * candidate so far, and the indices that distinguish full-evaluation
 * checkpoints from minibatch-only trials.
 *
 * The running-best score retains successful historical observations even
 * when a later checked checkpoint failure evicts their candidate from
 * future checkpoint selection.
 *
 * @since 0.1.0
 * @category refs
 * @see {@link makePhase3TrialRefs} — constructor
 * @see {@link evaluateTrial} — primary consumer
 */
export class Phase3TrialRefs extends Data.Class<{
  readonly trialCounter: Ref.Ref<number>
  readonly bestScoreRef: Ref.Ref<Option.Option<number>>
  readonly bestAveragingRef: Ref.Ref<Option.Option<BestAveragingCandidate>>
  readonly fullEvalTrialsRef: Ref.Ref<Schema.Array$<typeof Schema.Number>["Type"]>
  readonly minibatchTrialsRef: Ref.Ref<Schema.Array$<typeof Schema.Number>["Type"]>
}> {}

/** @internal */
export class ApplyPhase3ConfigOptions extends Data.Class<{
  readonly config: Phase3Config
  readonly bindings: Iterable<PredictorBinding>
  readonly trialBudget: number
}> {}

/** @internal */
export class EvaluateBaselineOptions<E, R> extends Data.Class<{
  readonly baselineConfig: Phase3Config
  readonly valset: MIPROExamples
  readonly refs: Phase3TrialRefs
  readonly evaluateOn: (config: Phase3Config, examples: MIPROExamples) => Effect.Effect<number, E, R>
}> {}

/** @internal */
export class EvaluateTrialOptions<E, R> extends Data.Class<{
  readonly config: Phase3Config
  readonly refs: Phase3TrialRefs
  readonly minibatchExamples: MIPROExamples
  readonly valset: MIPROExamples
  readonly fullEvalEvery: number
  readonly emit: Phase3EventSink
  readonly evaluateOn: (config: Phase3Config, examples: MIPROExamples) => Effect.Effect<number, E, R>
}> {}

/**
 * Allocates a fresh set of `Ref` cells for a Phase 3 search run.
 *
 * The trial counter starts at `0`, the best score is absent, and both
 * trial-index arrays start empty. Call once before entering the search loop.
 *
 * @since 0.1.0
 * @category constructors
 * @see {@link Phase3TrialRefs}
 */
export const makePhase3TrialRefs: Effect.Effect<Phase3TrialRefs> = Effect.gen(function*() {
  const trialCounter = yield* Ref.make(0)
  const bestScoreRef = yield* Ref.make<Option.Option<number>>(Option.none())
  const bestAveragingRef = yield* Ref.make<Option.Option<BestAveragingCandidate>>(Option.none())
  const fullEvalTrialsRef = yield* Ref.make<Schema.Array$<typeof Schema.Number>["Type"]>(Arr.empty())
  const minibatchTrialsRef = yield* Ref.make<Schema.Array$<typeof Schema.Number>["Type"]>(Arr.empty())

  return new Phase3TrialRefs({
    trialCounter,
    bestScoreRef,
    bestAveragingRef,
    fullEvalTrialsRef,
    minibatchTrialsRef
  })
})

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
export const applyPhase3Config = (options: ApplyPhase3ConfigOptions) =>
  Effect.forEach(options.bindings, (binding) =>
    Effect.gen(function*() {
      const demoIndex = yield* configIndex(options.config, demoDimensionName(binding.predictorName))
      const instructionIndex = yield* configIndex(options.config, instructionDimensionName(binding.predictorName))
      const demo = yield* Option.match(Arr.get(binding.demos.candidates, demoIndex), {
        onNone: () =>
          Effect.fail(
            new AllTrialsFailed({
              message: Str.concat(
                Str.concat("Missing demo candidate index ", Inspectable.toStringUnknown(demoIndex)),
                Str.concat(" for predictor '", Str.concat(binding.predictorName, "'"))
              ),
              trialCount: options.trialBudget
            })
          ),
        onSome: (candidate) => Effect.succeed(candidate)
      })
      const instruction = yield* Option.match(Arr.get(binding.instructions.candidates, instructionIndex), {
        onNone: () =>
          Effect.fail(
            new AllTrialsFailed({
              message: Str.concat(
                Str.concat("Missing instruction candidate index ", Inspectable.toStringUnknown(instructionIndex)),
                Str.concat(" for predictor '", Str.concat(binding.predictorName, "'"))
              ),
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
export const evaluateBaseline = <E, R>(options: EvaluateBaselineOptions<E, R>) =>
  Effect.gen(function*() {
    const baselineObjective = yield* options.evaluateOn(options.baselineConfig, options.valset)
    const priorTrial = new Study.PriorTrial<Phase3Config>({
      config: options.baselineConfig,
      value: baselineObjective
    })

    yield* Ref.set(options.refs.bestScoreRef, Option.some(baselineObjective))
    yield* Ref.set(
      options.refs.bestAveragingRef,
      Option.some(new BestAveragingCandidate({ config: options.baselineConfig, score: baselineObjective }))
    )

    return Tuple.make(baselineObjective, priorTrial)
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
 * the running-best score is updated accordingly. Ranking state is committed
 * only after the checkpoint succeeds. A checked failure also evicts the
 * checkpoint target if it is already stored, leaving a different prior
 * candidate intact. Historical successful scores remain recorded.
 *
 * Emits `TrialEvaluated` after every minibatch and `FullEvalCompleted`
 * after each checkpoint.
 *
 * @since 0.1.0
 * @category combinators
 * @see {@link evaluateBaseline} — warm-start counterpart
 * @see {@link Phase3TrialRefs} — mutable state consumed here
 */
export const evaluateTrial = <E, R>(options: EvaluateTrialOptions<E, R>) =>
  Effect.gen(function*() {
    const trial = yield* Ref.modify(options.refs.trialCounter, (count) => Data.tuple(count, Num.increment(count)))
    const score = yield* options.evaluateOn(options.config, options.minibatchExamples)
    const currentCandidate = yield* Ref.get(options.refs.bestAveragingRef)
    const nextCandidate = Option.match(Option.liftPredicate(Schema.is(Schema.Finite))(score), {
      onNone: () => currentCandidate,
      onSome: (score) =>
        Option.some(Option.match(currentCandidate, {
          onNone: () => new BestAveragingCandidate({ config: options.config, score }),
          onSome: (candidate) =>
            Bool.match(Num.greaterThanOrEqualTo(score, candidate.score), {
              onTrue: () => new BestAveragingCandidate({ config: options.config, score }),
              onFalse: () => candidate
            })
        }))
    })
    const checkpointCandidate = yield* Option.match(nextCandidate, {
      onNone: () =>
        Effect.fail(
          new AllTrialsFailed({
            message: "MIPROv2 Phase 3 has no successful finite checkpoint candidate",
            trialCount: Num.increment(trial)
          })
        ),
      onSome: Effect.succeed
    })

    yield* Ref.update(options.refs.minibatchTrialsRef, (trials) => Arr.append(trials, trial))
    yield* options.emit(MIPROv2Event.TrialEvaluated({ trial, score }))

    const fullEvalScore = yield* Effect.if(
      Num.Equivalence(Num.remainder(Num.increment(trial), options.fullEvalEvery), 0),
      {
        onTrue: () =>
          options.evaluateOn(checkpointCandidate.config, options.valset).pipe(
            Effect.tapError(() =>
              Ref.update(
                options.refs.bestAveragingRef,
                Option.filter((candidate) =>
                  Bool.not(Schema.equivalence(Phase3Config)(candidate.config, checkpointCandidate.config))
                )
              )
            ),
            Effect.asSome
          ),
        onFalse: () => Effect.succeedNone
      }
    )
    yield* Ref.set(options.refs.bestAveragingRef, nextCandidate)
    const bestScore = yield* Ref.modify(options.refs.bestScoreRef, (current) => {
      const minibatchBest = Option.match(current, {
        onNone: () => checkpointCandidate.score,
        onSome: (value) => Num.max(value, checkpointCandidate.score)
      })
      const next = Option.match(fullEvalScore, {
        onNone: () => minibatchBest,
        onSome: (value) => Num.max(minibatchBest, value)
      })
      return Data.tuple(next, Option.some(next))
    })
    yield* Option.match(fullEvalScore, {
      onNone: () => Effect.void,
      onSome: () =>
        Ref.update(options.refs.fullEvalTrialsRef, (trials) => Arr.append(trials, trial)).pipe(
          Effect.zipRight(options.emit(MIPROv2Event.FullEvalCompleted({ bestScore })))
        )
    })

    return score
  })
