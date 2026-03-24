/**
 * Timeout wrapper for objective function evaluation with cancellation support.
 *
 * @since 0.1.0
 */
import type { Exit } from "effect"
import { Deferred, Effect, Fiber, Option } from "effect"

import type { OptimizeSettings } from "../options.js"

type TrialTimeout = NonNullable<OptimizeSettings["trialTimeout"]>

/**
 * Wraps an objective evaluation with a timeout, returning None and interrupting the fiber if the deadline elapses.
 *
 * @since 0.1.0
 * @category utils
 */
export const evaluateObjectiveWithTimeout = <A, E, R>(
  objectiveEffect: Effect.Effect<A, E, R>,
  trialTimeout: TrialTimeout
): Effect.Effect<Option.Option<Exit.Exit<A, E>>, never, R> =>
  Effect.gen(function*() {
    const objectiveCompletion = yield* Deferred.make<Exit.Exit<A, E>, never>()
    const objectiveFiber = yield* objectiveEffect.pipe(
      Effect.exit,
      Effect.flatMap((exit) => Deferred.succeed(objectiveCompletion, exit)),
      Effect.asVoid,
      Effect.fork
    )

    const objectiveExitOption = yield* Deferred.await(objectiveCompletion).pipe(
      Effect.map(Option.some),
      Effect.timeout(trialTimeout),
      Effect.catchTag("TimeoutException", () => Effect.succeed(Option.none()))
    )

    yield* Effect.when(
      Fiber.interrupt(objectiveFiber).pipe(Effect.asVoid),
      () => Option.isNone(objectiveExitOption)
    )

    return objectiveExitOption
  })
