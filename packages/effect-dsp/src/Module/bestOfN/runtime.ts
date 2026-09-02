/**
 * Best-of-N forward runtime — runs N rollouts, scores each, returns best.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import type { Schema } from "effect"
import { Array as Arr, Effect, Match, Number as Num, Option, Order } from "effect"
import { withRollout } from "../../Cache/refs.js"
import type { MetricResult } from "../../contracts/MetricResult.js"
import type { Signature } from "../../Signature/model.js"
import type { Module } from "../model.js"

/**
 * Scores one module output in the context of its original input.
 *
 * @remarks
 * The callback cannot add a typed failure or service requirement. It may still
 * use Effect operations, read FiberRefs, be interrupted, or terminate with a
 * defect. `bestOfN` reads the score. `refine` also adds feedback to later
 * attempts.
 *
 * @typeParam I - Input fields decoded before the module call.
 * @typeParam O - Output fields decoded before scoring.
 *
 * @see {@link MetricResult} for the score and optional feedback.
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

const normalizeRunCount = (requested: number): number =>
  Match.value(requested).pipe(
    Match.when(Numeric.isFinite, (value) => Numeric.max(1, Numeric.floor(value))),
    Match.orElse(() => 1)
  )

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
export const makeBestOfNForward = <
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
  const normalizedN = normalizeRunCount(options.N)

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
