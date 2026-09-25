/**
 * Prompt construction golden fixtures and trace projection contracts.
 */
import * as Prompt from "@effect/ai/Prompt"
import { describe, expect, it } from "@effect/vitest"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import {
  Array as Arr,
  Boolean,
  Cause,
  Data,
  Deferred,
  Effect,
  Exit,
  FastCheck,
  Fiber,
  MutableRef,
  Number,
  ParseResult,
  Ref,
  Schema,
  String,
  Tuple
} from "effect"
import { makePrompt } from "../../src/internal/prompt/render.js"
import { promptToTraceText } from "../../src/internal/prompt/trace.js"
import { qaPromptWithDemo, qaPromptWithoutDemos } from "../fixtures/prompt/qa-prompt.fixture.js"

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with concise facts",
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )

const paramsWithDemo = new ModuleParameters({
  instructions: "Keep answers short.",
  demos: Arr.make(
    new Demonstration({
      input: { question: "What is the capital of France?" },
      output: { answer: "Paris" }
    })
  )
})

const paramsWithoutDemos = new ModuleParameters({
  instructions: "Keep answers short.",
  demos: Arr.empty()
})

const answerRequirements =
  "Respond with the corresponding output fields, starting with the field `[[ ## answer ## ]]`, and then ending with the marker for `[[ ## completed ## ]]`."

describe("internal/prompt", () => {
  it.effect.prop("retains exact text and message separators for empty, singleton and wider parts", {
    parts: FastCheck.array(FastCheck.string(), { maxLength: 4 })
  }, ({ parts }) =>
    Effect.gen(function*() {
      const texts = Arr.map(parts, (text) => String.concat(text, "\n\"\\\u0000\ud800Ω"))
      const prompt = Prompt.fromMessages(Arr.make(
        Prompt.systemMessage({ content: "before" }),
        Prompt.userMessage({ content: Arr.map(texts, (text) => Prompt.textPart({ text })) }),
        Prompt.assistantMessage({ content: Arr.of(Prompt.textPart({ text: "after\n" })) })
      ))
      const operation = promptToTraceText(prompt)
      const expected = Arr.join(Arr.make("before", Arr.join(texts, "\n"), "after\n"), "\n\n")
      expect(yield* operation).toBe(expected)
      expect(yield* operation).toBe(expected)
    }))

  it.effect("retains full native codecs for singleton structured and reasoning parts", () =>
    Effect.gen(function*() {
      const file = Prompt.filePart({ mediaType: "image/png", data: "aW1hZ2U=" })
      const call = Prompt.toolCallPart({
        id: "lookup-17",
        name: "LookupFacts",
        params: { country: "Japan", limit: 3 },
        providerExecuted: false
      })
      const result = Prompt.toolResultPart({
        id: "lookup-17",
        name: "LookupFacts",
        result: { city: "Tokyo", population: "37" },
        isFailure: false,
        providerExecuted: false
      })
      const cases = Tuple.make(
        {
          message: Prompt.userMessage({ content: Arr.of(file) }),
          expected: Schema.encode(Schema.parseJson(Prompt.FilePart))(file)
        },
        {
          message: Prompt.assistantMessage({ content: Arr.of(call) }),
          expected: Schema.encode(Schema.parseJson(Prompt.ToolCallPart))(call)
        },
        {
          message: Prompt.toolMessage({ content: Arr.of(result) }),
          expected: Schema.encode(Schema.parseJson(Prompt.ToolResultPart))(result)
        },
        {
          message: Prompt.assistantMessage({ content: Arr.of(Prompt.reasoningPart({ text: "reason\nverbatim" })) }),
          expected: Effect.succeed("reason\nverbatim")
        }
      )
      yield* Effect.forEach(cases, ({ message, expected }) =>
        Effect.gen(function*() {
          const text = yield* promptToTraceText(Prompt.fromMessages(Arr.of(message)))
          expect(text).toBe(yield* expected)
        }))
    }))

  it.effect("keeps serialization lazy, checked and independent on repeated execution", () =>
    Effect.gen(function*() {
      const calls = MutableRef.make(0)
      const result = Data.struct({
        toJSON: () => {
          MutableRef.increment(calls)
          const count = MutableRef.get(calls)
          return Boolean.match(Number.Equivalence(count, 1), { onTrue: () => 1n, onFalse: () => count })
        }
      })
      const operation = promptToTraceText(Prompt.fromMessages(Arr.of(Prompt.toolMessage({
        content: Arr.of(Prompt.toolResultPart({
          id: "changing-result",
          name: "LookupFacts",
          result,
          isFailure: false,
          providerExecuted: false
        }))
      }))))
      expect(MutableRef.get(calls)).toBe(0)
      const failure = yield* operation.pipe(Effect.flip)
      expect(failure._tag).toBe("TraceError")
      expect(failure.message).toBe("Prompt could not be serialized for tracing")
      expect(yield* operation).toContain("\"result\":2")
      expect(yield* operation).toContain("\"result\":3")
      expect(MutableRef.get(calls)).toBe(3)
    }))

  it.effect("keeps a wide part traversal interruptible after serialization begins", () =>
    Effect.gen(function*() {
      const started = yield* Deferred.make<void>()
      const calls = MutableRef.make(0)
      const part = Prompt.toolResultPart({
        id: "wide-result",
        name: "LookupFacts",
        result: Data.struct({
          toJSON: () => {
            MutableRef.increment(calls)
            Deferred.unsafeDone(started, Effect.void)
            return "part"
          }
        }),
        isFailure: false,
        providerExecuted: false
      })
      const operation = promptToTraceText(Prompt.fromMessages(Arr.of(Prompt.toolMessage({
        content: Arr.replicate(part, 4096)
      }))))
      expect(MutableRef.get(calls)).toBe(0)
      const fiber = yield* Effect.fork(operation)
      yield* Deferred.await(started)
      const exit = yield* Fiber.interrupt(fiber)
      const cause = yield* Exit.causeOption(exit)
      expect(Cause.isInterrupted(cause)).toBe(true)
      expect(Number.greaterThan(MutableRef.get(calls), 0)).toBe(true)
      expect(Number.lessThan(MutableRef.get(calls), 4096)).toBe(true)
    }))

  it.effect.prop("renders zero, one and multiple actual fields in order without changing their text", {
    first: FastCheck.string(),
    second: FastCheck.string(),
    keepFirst: FastCheck.boolean(),
    keepSecond: FastCheck.boolean()
  }, ({ first, second, keepFirst, keepSecond }) =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Optional fields", {
        first: Schema.optional(Schema.String),
        second: Schema.optional(Schema.String)
      }, { answer: Schema.String })
      const firstValue = Arr.join(Arr.make("first:", first, "\n\u0000\ud800Ω"), "")
      const secondValue = Arr.join(Arr.make("second:", second, "\"\\\udfff\n"), "")
      const input = {
        ...Boolean.match(keepFirst, { onTrue: () => ({ first: firstValue }), onFalse: () => ({}) }),
        ...Boolean.match(keepSecond, { onTrue: () => ({ second: secondValue }), onFalse: () => ({}) })
      }
      const blocks = Arr.map(
        Arr.filter(
          Arr.make(
            { present: keepFirst, text: String.concat("[[ ## first ## ]]\n", firstValue) },
            { present: keepSecond, text: String.concat("[[ ## second ## ]]\n", secondValue) }
          ),
          (entry) => entry.present
        ),
        (entry) => entry.text
      )
      const expected = Prompt.userMessage({
        content: Arr.of(Prompt.textPart({
          text: Arr.join(Arr.make(Arr.join(blocks, "\n\n"), answerRequirements), "\n\n")
        }))
      })
      const operation = makePrompt(signature)(paramsWithoutDemos, input)
      expect((yield* operation).content).toContainEqual(expected)
      expect((yield* operation).content).toContainEqual(expected)
    }))

  it.effect("defers and repeats asynchronous field decoding without caching input values", () =>
    Effect.gen(function*() {
      const decoded = yield* Ref.make(Arr.empty<string>())
      const question = Schema.declare<string, string, []>([], {
        decode: () => (input) =>
          Effect.gen(function*() {
            yield* Effect.yieldNow()
            const value = yield* ParseResult.decodeUnknown(Schema.String)(input)
            yield* Ref.update(decoded, Arr.append(value))
            return String.toUpperCase(value)
          }),
        encode: () => ParseResult.decodeUnknown(Schema.String)
      })
      const signature = yield* Signature.make("Answer questions", { question }, { answer: Schema.String })
      const render = makePrompt(signature)
      const operation = render(paramsWithoutDemos, { question: "abc" })
      expect(yield* Ref.get(decoded)).toEqual([])

      const first = yield* operation
      const repeated = yield* operation
      const changed = yield* render(paramsWithoutDemos, { question: "xyz" })
      expect(yield* Ref.get(decoded)).toEqual(["abc", "abc", "xyz"])
      yield* Effect.forEach(
        Arr.make(Tuple.make(first, "ABC"), Tuple.make(repeated, "ABC"), Tuple.make(changed, "XYZ")),
        ([prompt, text]) =>
          Effect.sync(() => {
            expect(prompt.content).toContainEqual(Prompt.userMessage({
              content: Arr.of(Prompt.textPart({
                text: Arr.join(Arr.make(String.concat("[[ ## question ## ]]\n", text), answerRequirements), "\n\n")
              }))
            }))
          })
      )
    }))

  it.effect("preserves structured field values and rejects lossy JSON before later valid rendering", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Answer questions", {
        facts: Schema.Struct({ label: Schema.String, score: Schema.NullOr(Schema.Number) })
      }, { answer: Schema.String })
      const render = makePrompt(signature)
      const first = yield* render(paramsWithoutDemos, { facts: { label: "first", score: null } })
      const failure = yield* Effect.flip(render(paramsWithoutDemos, { facts: { label: "bad", score: Infinity } }))
      const recovered = yield* render(paramsWithoutDemos, { facts: { label: "later", score: 7 } })
      expect(failure._tag).toBe("MalformedInput")
      yield* Effect.forEach(
        Arr.make(
          Tuple.make(first, "{\"label\":\"first\",\"score\":null}"),
          Tuple.make(recovered, "{\"label\":\"later\",\"score\":7}")
        ),
        ([prompt, text]) =>
          Effect.sync(() => {
            expect(prompt.content).toContainEqual(Prompt.userMessage({
              content: Arr.of(Prompt.textPart({
                text: Arr.join(Arr.make(String.concat("[[ ## facts ## ]]\n", text), answerRequirements), "\n\n")
              }))
            }))
          })
      )
    }))

  it.effect("builds system + demo + final-input prompt using golden fixture", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const prompt = yield* makePrompt(qa)(
        paramsWithDemo,
        { question: "What is the capital of Japan?" }
      )

      expect(prompt).toEqual(Prompt.make(qaPromptWithDemo))
    }))

  it.effect("builds system + final-input prompt when no demos are present", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const prompt = yield* makePrompt(qa)(
        paramsWithoutDemos,
        { question: "What is the capital of Japan?" }
      )

      expect(prompt).toEqual(Prompt.make(qaPromptWithoutDemos))
    }))
})
