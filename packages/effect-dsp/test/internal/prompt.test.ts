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
