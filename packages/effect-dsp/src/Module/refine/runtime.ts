/**
 * Refinement loop runtime.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import type { Schema } from "effect"
import { Data, Effect, Option, Ref } from "effect"
import type { MetricResult } from "../../contracts/MetricResult.js"
import { type ModuleParams, withModuleParamsInstructions } from "../../contracts/ModuleParams.js"
import type { RolloutCount } from "../../contracts/RolloutCount.js"
import type { Signature } from "../../Signature/model.js"
import type { RewardFn } from "../bestOfN/runtime.js"
import type { Module } from "../model.js"

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
    `${params.instructions}\n\n[Refinement feedback]\n${feedback}`
  )

/**
 * Build a typed `forward` function for a refine module.
 *
 * @since 0.1.0
 * @internal
 */
export const makeRefineForward = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: {
  readonly moduleName: string
  readonly signature: Signature<I, O>
  readonly innerModule: Module<I, O>
  readonly N: RolloutCount
  readonly reward: RewardFn<I, O>
  readonly threshold: number
  readonly forwardLock: Effect.Semaphore
}): Module<I, O>["forward"] => {
  type Output = Schema.Schema.Type<Schema.Struct<O>>
  type State = RefineLoopState<Output>

  const attemptFeedback = (attempt: number, result: MetricResult) =>
    Option.match(Option.fromNullable(result.feedback), {
      onSome: (fb) => `Attempt ${attempt} (score: ${result.score}): ${fb}`,
      onNone: () => `Attempt ${attempt} scored ${result.score}, below threshold ${options.threshold}.`
    })

  const recordFeedback = (accumulator: string, feedbackText: string, bestScore: number) =>
    Effect.gen(function*() {
      const nextFeedback = accumulator.length > 0
        ? `${accumulator}\n${feedbackText}`
        : feedbackText

      if (bestScore < options.threshold) {
        yield* Ref.update(
          options.innerModule.params,
          (params) => appendFeedback(params, nextFeedback)
        )
      }

      return nextFeedback
    })

  return Effect.fn(options.moduleName)((input) =>
    options.forwardLock.withPermits(1)(
      Effect.acquireUseRelease(
        Ref.get(options.innerModule.params),
        () =>
          Effect.gen(function*() {
            const firstOutput = yield* options.innerModule.forward(input)
            const firstResult = yield* options.reward(input, firstOutput)
            const firstFeedback = yield* recordFeedback(
              "",
              attemptFeedback(1, firstResult),
              firstResult.score
            )

            const seeded: State = {
              attempt: 1,
              bestOutput: firstOutput,
              bestScore: firstResult.score,
              feedbackAccumulator: firstFeedback
            }

            const finalState = yield* Effect.iterate(seeded, {
              while: (state) =>
                state.attempt < options.N &&
                state.bestScore < options.threshold,
              body: (state) =>
                Effect.gen(function*() {
                  const output = yield* options.innerModule.forward(input)
                  const result = yield* options.reward(input, output)

                  const newBest = result.score > state.bestScore
                  const nextOutput = newBest ? output : state.bestOutput
                  const nextScore = newBest ? result.score : state.bestScore

                  const nextFeedback = yield* recordFeedback(
                    state.feedbackAccumulator,
                    attemptFeedback(state.attempt + 1, result),
                    nextScore
                  )

                  return {
                    attempt: state.attempt + 1,
                    bestOutput: nextOutput,
                    bestScore: nextScore,
                    feedbackAccumulator: nextFeedback
                  }
                })
            })

            return finalState.bestOutput
          }),
        (baseParams) => Ref.set(options.innerModule.params, baseParams)
      )
    )
  )
}
