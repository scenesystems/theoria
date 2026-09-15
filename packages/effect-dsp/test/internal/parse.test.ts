/**
 * Output parsing tests for structured and text paths.
 */
import { describe, expect, it } from "@effect/vitest"
import { ParseOutputError } from "@scenesystems/effect-dsp/Errors"
import {
  Array as Arr,
  Cause,
  Data,
  Effect,
  Equal,
  Function,
  Number,
  Option,
  Ref,
  Schema,
  TestClock,
  Tuple
} from "effect"
import { parseStructuredOutput, parseTextOutput } from "../../src/internal/parse/decode.js"
import { parseTextWithRetry, ParseTextWithRetryOptions } from "../../src/internal/parse/retry.js"
import { defaultParseFeedbackTemplate, defaultParseRetrySchedule } from "../../src/Module/predict/policy.js"

const AnswerSchema = Schema.Struct({ answer: Schema.String })
const TextResponses = Schema.Array(Schema.String)
type TextResponses = typeof TextResponses.Type

class ProviderReadError extends Data.TaggedError("ProviderReadError")<{
  readonly message: string
}> {}

const makeReadText = (
  responses: Ref.Ref<TextResponses>,
  feedbackLog: Ref.Ref<TextResponses>
) =>
(feedback: Option.Option<string>) =>
  Effect.gen(function*() {
    const next = yield* Ref.modify(responses, (queue) => Data.tuple(Arr.head(queue), Arr.drop(queue, 1)))
    yield* Option.match(feedback, {
      onNone: () => Effect.void,
      onSome: (value) => Ref.update(feedbackLog, (entries) => Arr.append(entries, value))
    })

    return yield* next
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
      const error = yield* parseTextOutput("qa", AnswerSchema, "malformed output").pipe(Effect.flip)
      const diagnostic = yield* Arr.head(error.fieldDiagnostics)

      expect(error).toBeInstanceOf(ParseOutputError)
      expect(diagnostic.field).toBe("answer")
    }))

  it.effect("extracts adjacent and whitespace-padded markers and keeps the last duplicate", () =>
    Effect.gen(function*() {
      const parsed = yield* parseTextOutput(
        "qa",
        Schema.Struct({ answer: Schema.String, detail: Schema.String, empty: Schema.String }),
        "Ignored prefix 🦊\n[[## answer ##]] first [[ ## detail ## ]] café\nline 2 [[ ## answer ## ]] last [[ ## empty ## ]]"
      )

      expect(parsed).toEqual({ answer: "last", detail: "café\nline 2", empty: "" })
    }))

  it.effect("retains duplicate, missing, unexpected, and decode diagnostics in retry feedback", () =>
    Effect.gen(function*() {
      const error = yield* parseTextOutput(
        "qa",
        Schema.Struct({ answer: Schema.String, count: Schema.Number }),
        "[[## answer ##]] first [[ ## extra ## ]] value [[ ## answer ## ]] last"
      ).pipe(Effect.flip)

      expect(Arr.map(error.fieldDiagnostics, (diagnostic) => Tuple.make(diagnostic.field, diagnostic.issue))).toEqual(
        Arr.make(
          Tuple.make("answer", "duplicate-field"),
          Tuple.make("count", "missing-field"),
          Tuple.make("extra", "unexpected-field"),
          Tuple.make("count", "decode-error")
        )
      )
      expect(defaultParseFeedbackTemplate(error)).toBe(Arr.join(
        Arr.make(
          "Parse error (0): Unable to decode text output against module schema",
          "Field diagnostics:",
          "- answer (duplicate-field): Marker [[ ## answer ## ]] appeared 2 times",
          "- count (missing-field): Expected marker [[ ## count ## ]] was not found",
          "- extra (unexpected-field): Marker [[ ## extra ## ]] is not declared in the output schema",
          "- count (decode-error): is missing"
        ),
        "\n"
      ))
    }))

  it.effect("retries malformed outputs and succeeds with later valid output", () =>
    Effect.gen(function*() {
      const responses = yield* Ref.make<TextResponses>(Arr.make(
        "malformed output",
        "[[ ## answer ## ]]\nParis"
      ))
      const feedbackLog = yield* Ref.make<TextResponses>(Arr.empty())
      const parsedFiber = yield* Effect.fork(
        parseTextWithRetry(
          new ParseTextWithRetryOptions({
            moduleName: "qa",
            schema: AnswerSchema,
            maxRetries: 3,
            retrySchedule: defaultParseRetrySchedule,
            feedbackTemplate: defaultParseFeedbackTemplate,
            readText: makeReadText(responses, feedbackLog),
            text: Function.identity
          })
        )
      )

      yield* TestClock.adjust("2 seconds")

      const parsed = yield* Effect.fromFiber(parsedFiber)
      const feedback = yield* Ref.get(feedbackLog)
      const firstFeedback = yield* Arr.head(feedback)

      expect(Tuple.getFirst(parsed)).toEqual({ answer: "Paris" })
      expect(Tuple.getSecond(parsed)).toBe("[[ ## answer ## ]]\nParis")
      expect(feedback).toHaveLength(1)
      expect(firstFeedback).toContain("Parse error (0)")
      expect(firstFeedback).toContain("answer")
    }))

  it.effect("fails after retry exhaustion and preserves retry count propagation", () =>
    Effect.gen(function*() {
      const responses = yield* Ref.make<TextResponses>(Arr.make(
        "malformed output 1",
        "malformed output 2",
        "malformed output 3"
      ))
      const feedbackLog = yield* Ref.make<TextResponses>(Arr.empty())

      const failureFiber = yield* Effect.fork(
        Effect.flip(
          parseTextWithRetry(
            new ParseTextWithRetryOptions({
              moduleName: "qa",
              schema: AnswerSchema,
              maxRetries: 2,
              retrySchedule: defaultParseRetrySchedule,
              feedbackTemplate: defaultParseFeedbackTemplate,
              readText: makeReadText(responses, feedbackLog),
              text: Function.identity
            })
          )
        )
      )

      yield* TestClock.adjust("2 seconds")

      const error = yield* Effect.fromFiber(failureFiber).pipe(
        Effect.flatMap(Schema.decodeUnknown(ParseOutputError))
      )
      const feedback = yield* Ref.get(feedbackLog)
      const firstFeedback = yield* Arr.head(feedback)
      const secondFeedback = yield* Arr.get(feedback, 1)

      expect(error).toBeInstanceOf(ParseOutputError)
      expect(feedback).toHaveLength(2)
      expect(firstFeedback).toContain("Parse error (0)")
      expect(secondFeedback).toContain("Parse error (1)")
      expect(firstFeedback).toContain("answer")

      expect(error.retryCount).toEqual(Option.some(2))
      expect(error.moduleName).toBe("qa")
    }))

  it.effect("does not apply the parse retry policy to provider reader failures", () =>
    Effect.gen(function*() {
      const providerError = new ProviderReadError({ message: "provider unavailable" })
      const readCount = yield* Ref.make(0)
      const feedbackLog = yield* Ref.make<TextResponses>(Arr.empty())
      const exit = yield* Effect.exit(
        parseTextWithRetry(
          new ParseTextWithRetryOptions({
            moduleName: "qa",
            schema: AnswerSchema,
            maxRetries: 3,
            retrySchedule: defaultParseRetrySchedule,
            feedbackTemplate: defaultParseFeedbackTemplate,
            readText: (feedback) =>
              Ref.update(readCount, Number.increment).pipe(
                Effect.zipRight(
                  Option.match(feedback, {
                    onNone: () => Effect.void,
                    onSome: (value) => Ref.update(feedbackLog, (entries) => Arr.append(entries, value))
                  })
                ),
                Effect.zipRight(Effect.fail(providerError))
              ),
            text: Function.identity
          })
        )
      )
      const reads = yield* Ref.get(readCount)
      const feedback = yield* Ref.get(feedbackLog)
      const cause = yield* Effect.cause(exit)
      const failure = yield* Cause.failureOption(cause)

      expect(reads).toBe(1)
      expect(feedback).toEqual(Arr.empty())
      expect(Equal.equals(cause, Cause.fail(providerError))).toBe(true)
      expect(failure).toBe(providerError)
    }))
})
