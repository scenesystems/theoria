/**
 * Refinement loop runtime.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import { Array as Arr, Boolean, Data, Effect, Equivalence, Number, Option, Schema, String } from "effect"
import type { Semaphore } from "effect"
import type { Score } from "../../../Metric.js"
import type { Module } from "../../../Module.js"
import type { RefineOptions } from "../../../Module.js"
import { predictors } from "../../../ModuleGraph.js"
import { type ModuleParameters, withInstructions } from "../../../ModuleParameters.js"
import * as Binding from "../../parameterBinding.js"

class RefineLoopState<O> extends Data.Class<{
  readonly attempt: number
  readonly bestOutput: O
  readonly bestScore: number
  readonly feedbackAccumulator: string
}> {}

const iterateEffect = <A, E, R>(
  state: A,
  predicate: (state: A) => boolean,
  body: (state: A) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Boolean.match(predicate(state), {
    onFalse: () => Effect.succeed(state),
    onTrue: () => Effect.flatMap(body(state), (next) => Effect.suspend(() => iterateEffect(next, predicate, body)))
  })

const appendFeedback = (
  params: ModuleParameters,
  feedback: string
): ModuleParameters =>
  withInstructions(
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
  forwardLock: Semaphore.Semaphore
): Module<I, O, ModuleE | RewardE, ModuleR | RewardR>["forward"] => {
  type Output = Schema.Schema.Type<Schema.Struct<O>>

  const meetsThreshold = (score: number) =>
    Boolean.match(
      Boolean.and(
        Equivalence.strictEqual<number>()(score, score),
        Equivalence.strictEqual<number>()(options.threshold, options.threshold)
      ),
      {
        onTrue: () => Number.isGreaterThanOrEqualTo(score, options.threshold),
        onFalse: () => false
      }
    )

  const encodeNumber = (value: number) =>
    Option.getOrElse(
      Schema.encodeOption(Schema.FiniteFromString)(value),
      () => "NaN"
    )

  const attemptFeedback = (attempt: number, result: Score) =>
    Option.match(result.feedback, {
      onSome: (feedback) =>
        Arr.join(
          Arr.make(
            "Attempt ",
            encodeNumber(attempt),
            " (score: ",
            encodeNumber(result.value),
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
            encodeNumber(result.value),
            "; threshold: ",
            encodeNumber(options.threshold),
            "."
          ),
          ""
        )
    })

  const recordFeedback = (accumulator: string, feedbackText: string) =>
    Effect.gen(function*() {
      const nextFeedback = Boolean.match(String.isNonEmpty(accumulator), {
        onTrue: () => Arr.join(Arr.make(accumulator, "\n", feedbackText), ""),
        onFalse: () => feedbackText
      })

      return nextFeedback
    })

  return Effect.fn(options.name)((input) =>
    forwardLock.withPermits(1)(
      Effect.gen(function*() {
        const firstOutput = yield* options.module.forward(input)
        const firstResult = yield* options.reward(input, firstOutput)
        const firstFeedback = yield* recordFeedback(
          "",
          attemptFeedback(1, firstResult)
        )

        const seeded = new RefineLoopState<Output>({
          attempt: 1,
          bestOutput: firstOutput,
          bestScore: firstResult.value,
          feedbackAccumulator: firstFeedback
        })

        const finalState = yield* iterateEffect(
          seeded,
          (state) =>
            Boolean.and(
              Number.isLessThan(state.attempt, options.N),
              Boolean.not(meetsThreshold(state.bestScore))
            ),
          (state) =>
            Effect.gen(function*() {
              const parameters = yield* Binding.mapParameters(
                predictors(options.module),
                (params) => appendFeedback(params, state.feedbackAccumulator)
              )
              const output = yield* options.module.forward(input).pipe(
                Binding.withParameters(parameters),
                Binding.withOwners(predictors(options.module))
              )
              const result = yield* options.reward(input, output)

              const newBest = Boolean.match(Equivalence.strictEqual<number>()(result.value, result.value), {
                onTrue: () =>
                  Boolean.match(Equivalence.strictEqual<number>()(state.bestScore, state.bestScore), {
                    onTrue: () => Number.isGreaterThan(result.value, state.bestScore),
                    onFalse: () => true
                  }),
                onFalse: () => false
              })
              const nextOutput = Boolean.match(newBest, {
                onTrue: () => output,
                onFalse: () => state.bestOutput
              })
              const nextScore = Boolean.match(newBest, {
                onTrue: () => result.value,
                onFalse: () => state.bestScore
              })

              const nextFeedback = yield* recordFeedback(
                state.feedbackAccumulator,
                attemptFeedback(Number.increment(state.attempt), result)
              )

              return new RefineLoopState<Output>({
                attempt: Number.increment(state.attempt),
                bestOutput: nextOutput,
                bestScore: nextScore,
                feedbackAccumulator: nextFeedback
              })
            })
        )

        return finalState.bestOutput
      })
    )
  )
}
