/**
 * Refinement loop runtime.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import type { Schema } from "effect"
import { Effect, Match, Option, Ref } from "effect"
import { type ModuleParams, withModuleParamsInstructions } from "../../contracts/ModuleParams.js"
import type { Signature } from "../../Signature/model.js"
import type { RewardFn } from "../bestOfN/runtime.js"
import type { Module } from "../model.js"

type RefineLoopState<O> = Readonly<{
  readonly attempt: number
  readonly bestOutput: Option.Option<O>
  readonly bestScore: number
  readonly feedbackAccumulator: string
}>

const appendFeedback = (
  params: ModuleParams,
  feedback: string
): ModuleParams =>
  withModuleParamsInstructions(
    params,
    `${params.instructions}\n\n[Refinement feedback]\n${feedback}`
  )

const normalizeRunCount = (requested: number): number =>
  Match.value(requested).pipe(
    Match.when(Numeric.isFinite, (value) => Numeric.max(1, Numeric.floor(value))),
    Match.orElse(() => 1)
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
  readonly N: number
  readonly reward: RewardFn<I, O>
  readonly threshold: number
  readonly forwardLock: Effect.Semaphore
}): Module<I, O>["forward"] => {
  const normalizedN = normalizeRunCount(options.N)

  return Effect.fn(options.moduleName)((input) =>
    options.forwardLock.withPermits(1)(
      Effect.acquireUseRelease(
        Ref.get(options.innerModule.params),
        () => {
          const initialState: RefineLoopState<Schema.Schema.Type<Schema.Struct<O>>> = {
            attempt: 0,
            bestOutput: Option.none(),
            bestScore: -Infinity,
            feedbackAccumulator: ""
          }

          return Effect.iterate(initialState, {
            while: (state) =>
              state.attempt < normalizedN &&
              state.bestScore < options.threshold,
            body: (state) =>
              Effect.gen(function*() {
                const output = yield* options.innerModule.forward(input)
                const result = yield* options.reward(input, output)

                const newBest = result.score > state.bestScore
                const nextOutput = newBest ? Option.some(output) : state.bestOutput
                const nextScore = newBest ? result.score : state.bestScore

                const feedbackText = Option.match(Option.fromNullable(result.feedback), {
                  onSome: (fb) => `Attempt ${state.attempt + 1} (score: ${result.score}): ${fb}`,
                  onNone: () =>
                    `Attempt ${state.attempt + 1} scored ${result.score}, below threshold ${options.threshold}.`
                })

                const nextFeedback = state.feedbackAccumulator.length > 0
                  ? `${state.feedbackAccumulator}\n${feedbackText}`
                  : feedbackText

                if (nextScore < options.threshold) {
                  yield* Ref.update(
                    options.innerModule.params,
                    (params) => appendFeedback(params, nextFeedback)
                  )
                }

                return {
                  attempt: state.attempt + 1,
                  bestOutput: nextOutput,
                  bestScore: nextScore,
                  feedbackAccumulator: nextFeedback
                }
              })
          }).pipe(
            Effect.flatMap((finalState) =>
              Option.match(finalState.bestOutput, {
                onSome: (output) => Effect.succeed(output),
                onNone: () => Effect.die("refine: no candidates produced")
              })
            )
          )
        },
        (baseParams) => Ref.set(options.innerModule.params, baseParams)
      )
    )
  )
}
