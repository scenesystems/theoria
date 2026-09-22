import { Array, Clock, Context, Data, Effect, Number, Record, Schema, String } from "effect"

import * as Policy from "../Policy.js"

const isFiniteNumber = Schema.is(Schema.Finite)
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

const guard = <A, E>(options: Options<A, E>, failureMessage: (result: A) => string) => {
  const compute = Effect.sync(options.compute)
  const strict = Effect.filterOrFail(
    compute,
    options.isValid,
    (invalid) => options.makeError(failureMessage(invalid))
  )
  return Effect.contextWithEffect((context: Context.Context<Policy.Precision | Policy.Diagnostics>) => {
    const precision = Context.get(context, Policy.Precision)
    const diagnostics = Context.get(context, Policy.Diagnostics)
    const checked = Effect.if(String.Equivalence(precision.policy, "strict"), {
      onTrue: () => strict,
      onFalse: () => compute
    })

    return Effect.if(String.Equivalence(diagnostics.policy, "enabled"), {
      onTrue: () =>
        Effect.gen(function*() {
          const startedAt = yield* Clock.currentTimeMillis
          const result = yield* checked
          const finishedAt = yield* Clock.currentTimeMillis
          const annotations = Record.set(
            Record.set(options.annotations(result), "precision", precision.policy),
            "elapsedMs",
            encodeNumber(Number.subtract(finishedAt, startedAt))
          )
          yield* Effect.logDebug(options.operation).pipe(Effect.annotateLogs(annotations))
          return result
        }),
      onFalse: () => checked
    })
  })
}

export const scalar = <E>(options: ScalarOptions<E>) =>
  guard(
    {
      operation: options.operation,
      compute: options.compute,
      isValid: isFiniteNumber,
      makeError: options.makeError,
      annotations: options.annotations
    },
    (result) => Array.join(Array.make("Non-finite ", options.operation, " result: ", encodeNumber(result)), "")
  )

export const custom = <A, E>(options: Options<A, E>) =>
  guard(options, () => String.concat(String.concat("Non-finite ", options.operation), " result"))
