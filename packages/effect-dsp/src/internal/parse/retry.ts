/**
 * Parse retry schedule and orchestration.
 *
 * @since 0.1.0
 * @internal
 */
import { Data, Effect, Number, Option, Ref, Schema } from "effect"
import type * as Schedule from "effect/Schedule"
import { ParseOutputError } from "../../DspError.js"
import { parseTextOutput } from "./decode.js"

/**
 * Configuration for the parse-retry loop, including the output schema,
 * retry budget, schedule, feedback template, and the effectful reader
 * that produces fresh LLM text (optionally incorporating parse feedback).
 *
 * @since 0.1.0
 * @category models
 * @internal
 */
export class ParseTextWithRetryOptions<
  O extends Schema.Struct.Fields,
  A,
  RE,
  RR
> extends Data.Class<{
  readonly moduleName: string
  readonly schema: Schema.Struct<O>
  readonly maxRetries: number
  readonly retrySchedule: (maxRetries: number) => Schedule.Schedule<unknown, unknown, never>
  readonly feedbackTemplate: (error: ParseOutputError) => string
  readonly readText: (feedback: Option.Option<string>) => Effect.Effect<A, RE, RR>
  readonly text: (response: A) => string
}> {}

/**
 * Orchestrates a parse-retry loop: reads LLM text, attempts marker
 * extraction and schema decode, and on failure re-prompts the model with
 * a diagnostic feedback message describing what went wrong.
 *
 * Each retry increments the attempt counter embedded in the resulting
 * `ParseOutputError` so callers can inspect how many rounds were needed.
 *
 * @since 0.1.0
 * @category constructors
 * @internal
 */
export const parseTextWithRetry = <
  O extends Schema.Struct.Fields,
  A,
  RE,
  RR
>(
  options: ParseTextWithRetryOptions<O, A, RE, RR>
) =>
  Effect.gen(function*() {
    const parseFeedback = yield* Ref.make<Option.Option<string>>(Option.none())
    const parseAttempts = yield* Ref.make(0)

    return yield* Effect.gen(function*() {
      const feedback = yield* Ref.get(parseFeedback)
      const response = yield* options.readText(feedback)
      const rawOutput = options.text(response)
      const currentAttempt = yield* Ref.updateAndGet(parseAttempts, Number.increment)

      return yield* parseTextOutput(
        options.moduleName,
        options.schema,
        rawOutput
      ).pipe(
        Effect.mapError((error) =>
          new ParseOutputError({
            message: error.message,
            moduleName: error.moduleName,
            rawOutput: Option.orElse(error.rawOutput, () => Option.some(rawOutput)),
            retryCount: Option.some(Number.decrement(currentAttempt)),
            fieldDiagnostics: error.fieldDiagnostics
          })
        ),
        Effect.tapError((error) =>
          Ref.set(
            parseFeedback,
            Option.some(options.feedbackTemplate(error))
          )
        ),
        Effect.map((output) => Data.tuple(output, response))
      )
    }).pipe(
      Effect.retry({
        schedule: options.retrySchedule(options.maxRetries),
        while: Schema.is(ParseOutputError)
      })
    )
  })
