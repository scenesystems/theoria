/**
 * Parse retry schedule and orchestration.
 *
 * @since 0.1.0
 * @internal
 */
import type { Schema } from "effect"
import { Data, Effect, Option, Ref } from "effect"
import type * as Schedule from "effect/Schedule"
import { ParseOutputError } from "../../Errors/module.js"
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
  RE,
  RR
> extends Data.Class<{
  readonly moduleName: string
  readonly schema: Schema.Struct<O>
  readonly maxRetries: number
  readonly retrySchedule: (maxRetries: number) => Schedule.Schedule<unknown, unknown, never>
  readonly feedbackTemplate: (error: ParseOutputError) => string
  readonly readText: (feedback: Option.Option<string>) => Effect.Effect<string, RE, RR>
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
  RE,
  RR
>(
  options: ParseTextWithRetryOptions<O, RE, RR>
): Effect.Effect<
  Schema.Schema.Type<Schema.Struct<O>>,
  ParseOutputError | RE,
  RR | Schema.Schema.Context<Schema.Struct<O>>
> =>
  Effect.gen(function*() {
    const parseFeedback = yield* Ref.make<Option.Option<string>>(Option.none())
    const parseAttempts = yield* Ref.make(0)

    return yield* Effect.gen(function*() {
      const feedback = yield* Ref.get(parseFeedback)
      const rawOutput = yield* options.readText(feedback)
      const currentAttempt = yield* Ref.updateAndGet(parseAttempts, (attempts) => attempts + 1)

      return yield* parseTextOutput(
        options.moduleName,
        options.schema,
        rawOutput
      ).pipe(
        Effect.mapError((error) =>
          ParseOutputError.make({
            message: error.message,
            moduleName: error.moduleName,
            rawOutput: Option.orElse(error.rawOutput, () => Option.some(rawOutput)),
            retryCount: Option.some(currentAttempt - 1),
            fieldDiagnostics: error.fieldDiagnostics
          })
        ),
        Effect.tapError((error) =>
          Ref.set(
            parseFeedback,
            Option.some(options.feedbackTemplate(error))
          )
        )
      )
    }).pipe(
      Effect.retry(options.retrySchedule(options.maxRetries))
    )
  })
