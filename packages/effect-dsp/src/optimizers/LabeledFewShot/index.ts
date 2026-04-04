/**
 * LabeledFewShot optimizer — select `k` demonstrations from labeled training
 * data using deterministic pseudo-random sampling, without any teacher model
 * calls.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al., "DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines", 2023}
 * @since 0.1.0
 */
import type { Schema } from "effect"
import { Array as Arr, Data, Effect, Match, Option, Order, Ref } from "effect"
import { nextDeterministicSeed, normalizeDeterministicSeed } from "../../contracts/DeterministicSeed.js"
import { withModuleParamsDemos } from "../../contracts/ModuleParams.js"
import { Demo, type Example } from "../../Example/index.js"
import { collectModuleParamRefs } from "../../internal/module-params.js"
import type { Module } from "../../Module/model.js"

class ScoredDemo extends Data.Class<{
  readonly score: number
  readonly demo: Demo
}> {}

class SamplingState extends Data.Class<{
  readonly seed: number
  readonly scored: ReadonlyArray<ScoredDemo>
}> {}

const scoredDemoOrder: Order.Order<ScoredDemo> = Order.mapInput(Order.number, (entry) => entry.score)

/**
 * Configuration for LabeledFewShot — module, training set, number of demos
 * (`k`), and optional deterministic seed.
 *
 * @since 0.1.0
 * @category models
 */
export type LabeledFewShotOptions<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields> = Readonly<{
  readonly module: Module<I, O>
  readonly trainset: ReadonlyArray<Example>
  readonly k: number
  readonly seed?: number
}>

const labeledDemos = (trainset: ReadonlyArray<Example>): ReadonlyArray<Demo> =>
  Arr.filterMap(
    trainset,
    (example) =>
      Option.map(
        Option.fromNullable(example.output),
        (output) => new Demo({ input: example.input, output })
      )
  )

const selectRandomDemos = (demos: ReadonlyArray<Demo>, k: number, seed: number): ReadonlyArray<Demo> => {
  const normalizedK = Match.value(k).pipe(
    Match.when((value) => value < 0, () => 0),
    Match.orElse((value) => value)
  )
  const scored = Arr.reduce(
    demos,
    new SamplingState({ seed: normalizeDeterministicSeed(seed), scored: Arr.empty<ScoredDemo>() }),
    (state, demo) => {
      const next = nextDeterministicSeed(state.seed)

      return new SamplingState({
        seed: next,
        scored: Arr.append(state.scored, new ScoredDemo({ score: next, demo }))
      })
    }
  ).scored

  return Arr.take(
    Arr.map(Arr.sort(scored, scoredDemoOrder), (entry) => entry.demo),
    normalizedK
  )
}

/**
 * Select `k` random labeled demonstrations from the training set and attach
 * them to all predictor refs in the module graph. Uses deterministic
 * pseudo-random scoring for reproducible selection.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al. (2023)}
 * @since 0.1.0
 * @category constructors
 */
export const labeledFewShot = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: LabeledFewShotOptions<I, O>) =>
  Effect.gen(function*() {
    const seed = Option.getOrElse(Option.fromNullable(options.seed), () => 1)
    const demos = yield* Effect.sync(() => selectRandomDemos(labeledDemos(options.trainset), options.k, seed))
    const refs = collectModuleParamRefs(options.module)

    yield* Effect.forEach(
      refs,
      (entry) => Ref.update(entry.params, (params) => withModuleParamsDemos(params, demos)),
      { discard: true }
    )

    return options.module
  })
