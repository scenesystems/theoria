import { Array, Clock, Data, Effect, Match, Number, Record, Schema, String } from "effect"

import * as Policy from "../Policy.js"

const FiniteNumber = Schema.Number.pipe(Schema.finite())
const encodeNumber = Schema.encodeSync(Schema.NumberFromString)

class Options<A, E> extends Data.Class<{
  readonly operation: string
  readonly compute: () => A
  readonly isValid: (result: A) => boolean
  readonly makeError: (message: string) => E
  readonly annotations: (result: A) => Record.ReadonlyRecord<string, string>
}> {}

class ScalarOptions<E> extends Data.Class<{
  readonly operation: string
  readonly compute: () => number
  readonly makeError: (message: string) => E
  readonly annotations: (result: number) => Record.ReadonlyRecord<string, string>
}> {}

const guard = <A, E>(options: Options<A, E>, failureMessage: (result: A) => string) =>
  Effect.gen(function*() {
    const precision = yield* Policy.Precision
    const diagnostics = yield* Policy.Diagnostics
    const compute = Effect.sync(options.compute).pipe(
      Effect.flatMap((result) =>
        Match.value(precision.policy).pipe(
          Match.when("strict", () =>
            Effect.filterOrFail(
              Effect.succeed(result),
              options.isValid,
              (invalid) => options.makeError(failureMessage(invalid))
            )),
          Match.when("relaxed", () => Effect.succeed(result)),
          Match.exhaustive
        )
      )
    )

    return yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () =>
        Effect.gen(function*() {
          const startedAt = yield* Clock.currentTimeMillis
          const result = yield* compute
          const finishedAt = yield* Clock.currentTimeMillis
          const annotations = Record.set(
            Record.set(options.annotations(result), "precision", precision.policy),
            "elapsedMs",
            encodeNumber(Number.subtract(finishedAt, startedAt))
          )
          yield* Effect.logDebug(options.operation).pipe(Effect.annotateLogs(annotations))
          return result
        })),
      Match.when("disabled", () => compute),
      Match.exhaustive
    )
  })

export const scalar = <E>(options: ScalarOptions<E>) =>
  guard(
    new Options({
      operation: options.operation,
      compute: options.compute,
      isValid: Schema.is(FiniteNumber),
      makeError: options.makeError,
      annotations: options.annotations
    }),
    (result) => Array.join(Array.make("Non-finite ", options.operation, " result: ", encodeNumber(result)), "")
  )

export const custom = <A, E>(options: Options<A, E>) =>
  guard(options, () => String.concat(String.concat("Non-finite ", options.operation), " result"))
