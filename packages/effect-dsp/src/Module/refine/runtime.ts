/**
 * Refinement loop runtime.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import { Array as Arr, Boolean, Data, Effect, Number, Option, Ref, Schema, String } from "effect"
import type { MetricResult } from "../../contracts/MetricResult.js"
import { type ModuleParams, withModuleParamsInstructions } from "../../contracts/ModuleParams.js"
import type { Module } from "../model.js"
import type { RefineOptions } from "./index.js"

class RefineLoopState<O> extends Data.Class<{
  readonly attempt: number
  readonly bestOutput: O
  readonly bestScore: number
  readonly feedbackAccumulator: string
}> {}

const appendFeedback = (
  params: ModuleParams,
  feedback: string
): ModuleParams =>
  withModuleParamsInstructions(
    params,
    Arr.join(
      Arr.make(params.instructions, "\n\n[Refinement feedback]\n", feedback),
      ""
    )
  )

/**
 * Build a typed `forward` function for a refine module.
 *
 * @since 0.1.0
 * @internal
 */
export const makeRefineForward = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ModuleE,
  ModuleR,
  RewardE,
  RewardR
>(
  options: RefineOptions<I, O, ModuleE, ModuleR, RewardE, RewardR>,
  forwardLock: Effect.Semaphore
): Module<I, O, ModuleE | RewardE, ModuleR | RewardR>["forward"] => {
  type Output = Schema.Schema.Type<Schema.Struct<O>>

  const encodeNumber = (value: number) =>
    Option.getOrElse(
      Schema.encodeOption(Schema.NumberFromString)(value),
      () => "NaN"
    )

  const attemptFeedback = (attempt: number, result: MetricResult) =>
    Option.match(Option.fromNullable(result.feedback), {
      onSome: (feedback) =>
        Arr.join(
          Arr.make(
            "Attempt ",
            encodeNumber(attempt),
            " (score: ",
            encodeNumber(result.score),
            "): ",
            feedback
          ),
          ""
        ),
      onNone: () =>
        Arr.join(
          Arr.make(
            "Attempt ",
            encodeNumber(attempt),
            " scored ",
            encodeNumber(result.score),
            ", below threshold ",
            encodeNumber(options.threshold),
            "."
          ),
          ""
        )
    })

  const recordFeedback = (accumulator: string, feedbackText: string, bestScore: number) =>
    Effect.gen(function*() {
      const nextFeedback = Boolean.match(String.isNonEmpty(accumulator), {
        onTrue: () => Arr.join(Arr.make(accumulator, "\n", feedbackText), ""),
        onFalse: () => feedbackText
      })

      yield* Effect.if(Number.lessThan(bestScore, options.threshold), {
        onTrue: () =>
          Ref.update(
            options.module.params,
            (params) => appendFeedback(params, nextFeedback)
          ),
        onFalse: () => Effect.void
      })

      return nextFeedback
    })

  return Effect.fn(options.name)((input) =>
    forwardLock.withPermits(1)(
      Effect.acquireUseRelease(
        Ref.get(options.module.params),
        () =>
          Effect.gen(function*() {
            const firstOutput = yield* options.module.forward(input)
            const firstResult = yield* options.reward(input, firstOutput)
            const firstFeedback = yield* recordFeedback(
              "",
              attemptFeedback(1, firstResult),
              firstResult.score
            )

            const seeded = new RefineLoopState<Output>({
              attempt: 1,
              bestOutput: firstOutput,
              bestScore: firstResult.score,
              feedbackAccumulator: firstFeedback
            })

            const finalState = yield* Effect.iterate(seeded, {
              while: (state) =>
                Boolean.and(
                  Number.lessThan(state.attempt, options.N),
                  Number.lessThan(state.bestScore, options.threshold)
                ),
              body: (state) =>
                Effect.gen(function*() {
                  const output = yield* options.module.forward(input)
                  const result = yield* options.reward(input, output)

                  const newBest = Boolean.match(Schema.is(Schema.NonNaN)(result.score), {
                    onTrue: () => Number.greaterThan(result.score, state.bestScore),
                    onFalse: () => false
                  })
                  const nextOutput = Boolean.match(newBest, {
                    onTrue: () => output,
                    onFalse: () => state.bestOutput
                  })
                  const nextScore = Boolean.match(newBest, {
                    onTrue: () => result.score,
                    onFalse: () => state.bestScore
                  })

                  const nextFeedback = yield* recordFeedback(
                    state.feedbackAccumulator,
                    attemptFeedback(Number.increment(state.attempt), result),
                    nextScore
                  )

                  return new RefineLoopState<Output>({
                    attempt: Number.increment(state.attempt),
                    bestOutput: nextOutput,
                    bestScore: nextScore,
                    feedbackAccumulator: nextFeedback
                  })
                })
            })

            return finalState.bestOutput
          }),
        (baseParams) => Ref.set(options.module.params, baseParams)
      )
    )
  )
}
