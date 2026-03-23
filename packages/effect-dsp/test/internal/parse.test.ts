/**
 * Output parsing tests for structured and text paths.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Cause, Effect, Exit, Option, Ref, Schema, TestClock } from "effect"
import { ParseOutputError } from "effect-dsp/Errors"
import { parseStructuredOutput, parseTextOutput } from "../../src/internal/parse/decode.js"
import { parseTextWithRetry, ParseTextWithRetryOptions } from "../../src/internal/parse/retry.js"
import { defaultParseFeedbackTemplate, defaultParseRetrySchedule } from "../../src/Module/predict/policy.js"

const AnswerSchema = Schema.Struct({ answer: Schema.String })

const makeReadText = (
  responses: Ref.Ref<ReadonlyArray<string>>,
  feedbackLog: Ref.Ref<ReadonlyArray<string>>
) =>
(feedback: Option.Option<string>) =>
  Effect.gen(function*() {
    const queue = yield* Ref.get(responses)

    yield* Ref.set(responses, Arr.drop(queue, 1))
    yield* Option.match(feedback, {
      onNone: () => Effect.void,
      onSome: (value) => Ref.update(feedbackLog, (entries) => Arr.append(entries, value))
    })

    return Option.getOrElse(Arr.head(queue), () => "[[ ## answer ## ]]\nfallback")
  })

describe("internal/parse", () => {
  it.effect("decodes structured output using schema", () =>
    Effect.gen(function*() {
      const parsed = yield* parseStructuredOutput(
        "qa",
        AnswerSchema,
        { answer: "Paris" }
      )

      expect(parsed).toEqual({ answer: "Paris" })
    }))

  it.effect("extracts marker-delimited text output", () =>
    Effect.gen(function*() {
      const parsed = yield* parseTextOutput(
        "qa",
        AnswerSchema,
        "[[ ## answer ## ]]\nParis"
      )

      expect(parsed).toEqual({ answer: "Paris" })
    }))

  it.effect("fails with ParseOutputError when text output is malformed", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(
        parseTextOutput("qa", AnswerSchema, "malformed output")
      )

      const failure = Exit.match(exit, {
        onFailure: Cause.failureOption,
        onSuccess: () => Option.none<ParseOutputError>()
      })

      expect(Option.isSome(failure)).toBe(true)

      yield* Option.match(failure, {
        onSome: (error) =>
          Effect.sync(() => {
            expect(error).toBeInstanceOf(ParseOutputError)
            expect(error.fieldDiagnostics.length > 0).toBe(true)
            expect(error.fieldDiagnostics[0]?.field).toBe("answer")
          }),
        onNone: () => Effect.die("Expected ParseOutputError failure")
      })
    }))

  it.effect("retries malformed outputs and succeeds with later valid output", () =>
    Effect.gen(function*() {
      const responses = yield* Ref.make<ReadonlyArray<string>>([
        "malformed output",
        "[[ ## answer ## ]]\nParis"
      ])
      const feedbackLog = yield* Ref.make<ReadonlyArray<string>>([])
      const parsedFiber = yield* Effect.fork(
        parseTextWithRetry(
          new ParseTextWithRetryOptions({
            moduleName: "qa",
            schema: AnswerSchema,
            maxRetries: 3,
            retrySchedule: defaultParseRetrySchedule,
            feedbackTemplate: defaultParseFeedbackTemplate,
            readText: makeReadText(responses, feedbackLog)
          })
        )
      )

      yield* TestClock.adjust("2 seconds")

      const parsed = yield* Effect.fromFiber(parsedFiber)

      const feedback = yield* Ref.get(feedbackLog)

      expect(parsed).toEqual({ answer: "Paris" })
      expect(feedback).toHaveLength(1)
      expect(feedback[0]).toContain("Parse error (0)")
      expect(feedback[0]).toContain("answer")
    }))

  it.effect("fails after retry exhaustion and preserves retry count propagation", () =>
    Effect.gen(function*() {
      const responses = yield* Ref.make<ReadonlyArray<string>>([
        "malformed output 1",
        "malformed output 2",
        "malformed output 3"
      ])
      const feedbackLog = yield* Ref.make<ReadonlyArray<string>>([])

      const exitFiber = yield* Effect.fork(
        Effect.exit(
          parseTextWithRetry(
            new ParseTextWithRetryOptions({
              moduleName: "qa",
              schema: AnswerSchema,
              maxRetries: 2,
              retrySchedule: defaultParseRetrySchedule,
              feedbackTemplate: defaultParseFeedbackTemplate,
              readText: makeReadText(responses, feedbackLog)
            })
          )
        )
      )

      yield* TestClock.adjust("2 seconds")

      const exit = yield* Effect.fromFiber(exitFiber)
      const failure = Exit.match(exit, {
        onSuccess: () => Option.none<ParseOutputError>(),
        onFailure: Cause.failureOption
      })
      const feedback = yield* Ref.get(feedbackLog)

      expect(Option.isSome(failure)).toBe(true)
      expect(feedback).toHaveLength(2)
      expect(feedback[0]).toContain("Parse error (0)")
      expect(feedback[1]).toContain("Parse error (1)")
      expect(feedback[0]).toContain("answer")

      yield* Option.match(failure, {
        onSome: (error) =>
          Effect.sync(() => {
            expect(error.retryCount).toEqual(Option.some(2))
            expect(error.moduleName).toBe("qa")
          }),
        onNone: () => Effect.die("Expected ParseOutputError failure")
      })
    }))
})
