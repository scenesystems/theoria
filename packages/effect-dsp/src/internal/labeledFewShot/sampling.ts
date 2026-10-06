/**
 * Shared deterministic labeled-demonstration sampling.
 *
 * @since 0.1.0
 * @internal
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { nextDeterministicSeed, normalizeDeterministicSeed } from "@scenesystems/effect-search/Sampler"
import { Array as Arr, Effect, Match, Number as Num, Option, Order, Schema } from "effect"
import { Demonstration as Demo } from "../../Demonstration.js"
import { Example, id } from "../../Example.js"
import type { Sampling } from "../sampling/cpython.js"

class ScoredDemo extends Schema.Class<ScoredDemo>(
  "@scenesystems/effect-dsp/internal/labeledFewShot/sampling/ScoredDemo"
)({
  score: Schema.Finite,
  demo: Demo
}) {}

class SamplingState extends Schema.Class<SamplingState>(
  "@scenesystems/effect-dsp/internal/labeledFewShot/sampling/SamplingState"
)({
  seed: Schema.Finite,
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

/** Samples labeled rows under the caller's CPython stream before decoding destinations. @internal */
export const sampleLabeled = (trainset: LabeledExamples, k: number, sampling: Sampling, sample = true) =>
  Effect.gen(function*() {
    const labeled = Arr.filter(trainset, (example) => Option.isSome(example.labels))
    const selected = sample ? yield* sampling.sample(labeled, Numeric.min(k, labeled.length)) : Arr.take(labeled, k)
    return yield* Effect.forEach(selected, (example) =>
      id(example).pipe(Effect.map((exampleId) =>
        new Demo({
          input: example.input,
          output: Option.getOrThrow(example.labels),
          exampleId: Option.some(exampleId)
        })
      )))
  })

/** @internal */
export const labeledDemos = (trainset: LabeledExamples): LabeledDemos =>
  Arr.flatMap(
    trainset,
    (example) =>
      Option.map(
        example.labels,
        (output) => new Demo({ input: example.input, output })
      ).pipe(Option.toArray)
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
