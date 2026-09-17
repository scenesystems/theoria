/**
 * Best-of-N forward runtime — runs N rollouts, scores each, returns best.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import type { Schema } from "effect"
import { Array as Arr, Boolean, Data, Effect, identity, Number as Num, Option, Order, Schema as S } from "effect"
import { withRollout } from "../../../Cache.js"
import type { BestOfNOptions, Module } from "../../../Module.js"

class ScoredCandidate<O> extends Data.Class<{
  readonly output: O
  readonly score: number
  readonly rolloutIndex: number
}> {}

const scoredCandidateOrder = <O>(): Order.Order<ScoredCandidate<O>> =>
  Order.combine(
    Order.reverse(Order.mapInput(Num.Order, (candidate: ScoredCandidate<O>) => candidate.score)),
    Order.mapInput(Num.Order, (candidate: ScoredCandidate<O>) => candidate.rolloutIndex)
  )

/**
 * Build a typed `forward` function for a best-of-N module.
 *
 * @since 0.1.0
 * @internal
 */
export const makeBestOfNForward = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ModuleE,
  ModuleR,
  RewardE,
  RewardR
>(
  options: BestOfNOptions<I, O, ModuleE, ModuleR, RewardE, RewardR>
): Module<I, O, ModuleE | RewardE, ModuleR | RewardR>["forward"] => {
  const rolloutIndices: Arr.NonEmptyArray<number> = Arr.makeBy(options.N, identity)

  return Effect.fn(options.name)((input) =>
    Effect.gen(function*() {
      const candidates = yield* Effect.forEach(
        rolloutIndices,
        (rolloutIndex) =>
          withRollout(
            rolloutIndex,
            Effect.gen(function*() {
              const output = yield* options.module.forward(input)
              const result = yield* options.reward(input, output)
              const candidate = new ScoredCandidate<Schema.Schema.Type<Schema.Struct<O>>>({
                output,
                score: result.score,
                rolloutIndex
              })

              return candidate
            })
          )
      )

      const sorted = Arr.sort(
        Arr.filter(candidates, (candidate) => S.is(S.NonNaN)(candidate.score)),
        scoredCandidateOrder<Schema.Schema.Type<Schema.Struct<O>>>()
      )
      const best = Option.getOrElse(
        Arr.head(sorted),
        () => Arr.headNonEmpty(candidates)
      )

      return Option.match(Option.fromNullable(options.threshold), {
        onSome: (threshold) =>
          Option.getOrElse(
            Arr.findFirst(
              sorted,
              (candidate) =>
                Boolean.match(S.is(S.NonNaN)(threshold), {
                  onTrue: () => Num.greaterThanOrEqualTo(candidate.score, threshold),
                  onFalse: () => false
                })
            ),
            () => best
          ),
        onNone: () => best
      }).output
    })
  )
}
