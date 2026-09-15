/**
 * Timeout wrapper for objective function evaluation with cancellation support.
 *
 * @since 0.1.0
 */
import { Boolean as Bool, Cause, type Duration, Effect, Exit, Fiber, Option } from "effect"

/**
 * Wraps an objective evaluation with a timeout. When the deadline elapses the
 * objective's fiber is interrupted and its final exit is awaited: an exit that is
 * nothing but that interruption is the ordinary cancellation and yields `None`,
 * while anything else in it is kept as `Some` so the study sees it. The runtime
 * strips typed failures from a fiber that is being interrupted, so what survives is
 * what the objective died from on its way out, such as a rejected report a cleanup
 * finalizer escalated with `orDie`.
 *
 * @since 0.1.0
 * @category utils
 */
export const evaluateObjectiveWithTimeout = <A, E, R>(
  objectiveEffect: Effect.Effect<A, E, R>,
  trialTimeout: Duration.Duration
): Effect.Effect<Option.Option<Exit.Exit<A, E>>, never, R> =>
  Effect.gen(function*() {
    const objectiveFiber = yield* Effect.fork(objectiveEffect)
    const completed = yield* Fiber.await(objectiveFiber).pipe(Effect.timeoutOption(trialTimeout))

    return yield* Option.match(completed, {
      onSome: (exit) => Effect.succeedSome(exit),
      onNone: () =>
        Fiber.interrupt(objectiveFiber).pipe(
          Effect.map(
            Exit.match({
              onSuccess: (value) => Option.some(Exit.succeed(value)),
              onFailure: (cause) =>
                Bool.match(Cause.isInterruptedOnly(cause), {
                  onTrue: () => Option.none(),
                  onFalse: () => Option.some(Exit.failCause(cause))
                })
            })
          )
        )
    })
  })
