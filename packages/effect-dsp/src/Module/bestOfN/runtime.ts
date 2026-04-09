/**
 * Best-of-N forward runtime — runs N rollouts, scores each, returns best.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import type { Schema } from "effect"
import { Array as Arr, Effect, Number as Num, Option, Order } from "effect"
import { withRollout } from "../../Cache/refs.js"
import type { MetricResult } from "../../contracts/MetricResult.js"
import type { Signature } from "../../Signature/model.js"
import type { Module } from "../model.js"

/**
 * Pure scoring function that evaluates a single module output given the
 * original input. Used by `bestOfN` and `refine` to rank candidates.
 * Must not introduce additional error or requirement channels — the
 * reward runs inside the module's fixed `forward` signature.
 *
 * @see {@link MetricResult} — the score + optional feedback returned
 *
 * @since 0.1.0
 * @category models
 */
export type RewardFn<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
> = (
  input: Schema.Schema.Type<Schema.Struct<I>>,
  output: Schema.Schema.Type<Schema.Struct<O>>
) => Effect.Effect<MetricResult>

type ScoredCandidate<O> = Readonly<{
  readonly output: O
  readonly score: number
  readonly rolloutIndex: number
}>

const scoredCandidateOrder: Order.Order<ScoredCandidate<unknown>> = Order.combine(
  Order.reverse(Order.mapInput(Num.Order, (candidate: ScoredCandidate<unknown>) => candidate.score)),
  Order.mapInput(Num.Order, (candidate: ScoredCandidate<unknown>) => candidate.rolloutIndex)
)

/**
 * Build a typed `forward` function for a best-of-N module.
 *
 * @since 0.1.0
 * @internal
 */
export const BestOfNRuntime = {
  forward: <
    I extends Schema.Struct.Fields,
    O extends Schema.Struct.Fields
  >(options: {
    readonly moduleName: string
    readonly signature: Signature<I, O>
    readonly innerModule: Module<I, O>
    readonly N: number
    readonly reward: RewardFn<I, O>
    readonly threshold?: number
  }): Module<I, O>["forward"] => {
    const normalizedN = Num.clamp(options.N, { minimum: 1, maximum: options.N })

    return Effect.fn(options.moduleName)((input) =>
      Effect.gen(function*() {
        const candidates = yield* Effect.forEach(
          Arr.range(0, normalizedN - 1),
          (rolloutIndex) =>
            withRollout(
              rolloutIndex,
              Effect.gen(function*() {
                const output = yield* options.innerModule.forward(input)
                const result = yield* options.reward(input, output)
                const candidate: ScoredCandidate<Schema.Schema.Type<Schema.Struct<O>>> = {
                  output,
                  score: result.score,
                  rolloutIndex
                }

                return candidate
              })
            )
        )

        const sorted = Arr.sort(candidates, scoredCandidateOrder)

        const selected = Option.match(Option.fromNullable(options.threshold), {
          onSome: (threshold) =>
            Option.orElse(
              Arr.findFirst(sorted, (candidate) => candidate.score >= threshold),
              () => Arr.head(sorted)
            ),
          onNone: () => Arr.head(sorted)
        })

        return yield* Option.match(selected, {
          onSome: (candidate) => Effect.succeed(candidate.output),
          onNone: () => Effect.die("bestOfN: no candidates produced")
        })
      })
    )
  }
}
