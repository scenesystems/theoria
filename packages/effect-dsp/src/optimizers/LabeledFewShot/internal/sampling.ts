/**
 * Shared deterministic labeled-demonstration sampling.
 *
 * @since 0.1.0
 * @internal
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Match, Number as Num, Option, Order, Schema } from "effect"
import { nextDeterministicSeed, normalizeDeterministicSeed } from "../../../contracts/DeterministicSeed.js"
import { Demo, Example } from "../../../Example/index.js"

class ScoredDemo extends Schema.Class<ScoredDemo>("LabeledFewShotScoredDemo")({
  score: Schema.Number,
  demo: Demo
}) {}

class SamplingState extends Schema.Class<SamplingState>("LabeledFewShotSamplingState")({
  seed: Schema.Number,
  scored: Schema.Array(ScoredDemo)
}) {}

const scoredDemoOrder: Order.Order<ScoredDemo> = Order.mapInput(Num.Order, (entry) => entry.score)

/** @internal */
export const LabeledExamples = Schema.Array(Example)

/** @internal */
export type LabeledExamples = typeof LabeledExamples.Type

/** @internal */
export const LabeledDemos = Schema.Array(Demo)

/** @internal */
export type LabeledDemos = typeof LabeledDemos.Type

/** @internal */
export const labeledDemos = (trainset: LabeledExamples): LabeledDemos =>
  Arr.filterMap(
    trainset,
    (example) =>
      Option.map(
        Option.fromNullable(example.output),
        (output) => new Demo({ input: example.input, output })
      )
  )

/** @internal */
export const selectRandomDemos = (demos: LabeledDemos, k: number, seed: number): LabeledDemos => {
  const normalizedK = Match.value(k).pipe(
    Match.when(Numeric.isFinite, (value) => Numeric.max(0, Numeric.floor(value))),
    Match.orElse(() => 0)
  )
  const scored = Arr.reduce(
    demos,
    new SamplingState({ seed: normalizeDeterministicSeed(seed), scored: Arr.empty() }),
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
