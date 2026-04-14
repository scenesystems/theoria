/**
 * Refine forward runtime — iterative improvement with feedback accumulation.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import type { Schema } from "effect"
import { Effect, Number as Num, Option, Ref } from "effect"
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

/**
 * Build a typed `forward` function for a refine module.
 *
 * @since 0.1.0
 * @internal
 */
export const RefineRuntime = {
  forward: <
    I extends Schema.Struct.Fields,
    O extends Schema.Struct.Fields
  >(options: {
    readonly moduleName: string
    readonly signature: Signature<I, O>
    readonly innerModule: Module<I, O>
    readonly N: number
    readonly reward: RewardFn<I, O>
    readonly threshold: number
  }): Module<I, O>["forward"] => {
    const normalizedN = Num.clamp(options.N, { minimum: 1, maximum: options.N })

    return Effect.fn(options.moduleName)((input) =>
      Effect.gen(function*() {
        const baseParams = yield* Ref.get(options.innerModule.params)

        const initialState: RefineLoopState<Schema.Schema.Type<Schema.Struct<O>>> = {
          attempt: 0,
          bestOutput: Option.none(),
          bestScore: -Infinity,
          feedbackAccumulator: ""
        }

        const finalState = yield* Effect.iterate(initialState, {
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
                  `Attempt ${state.attempt + 1} scored ${result.score} — below threshold ${options.threshold}.`
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
        })

        yield* Ref.set(options.innerModule.params, baseParams)

        return yield* Option.match(finalState.bestOutput, {
          onSome: (output) => Effect.succeed(output),
          onNone: () => Effect.die("refine: no candidates produced")
        })
      })
    )
  }
}
