/**
 * Module.react contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { decode } from "@scenesystems/effect-dsp/Payload"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Array as Arr, Effect, Match, Option, Ref, Schema, String as Str } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Response from "effect/ai/Response"
import * as Tool from "effect/ai/Tool"
import * as Toolkit from "effect/ai/Toolkit"

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

const LookupFacts = Tool.make("LookupFacts", {
  description: "Look up a concise factual answer for a question",
  parameters: Schema.Struct({
    question: Schema.String
  }),
  success: Schema.String
})

const emptyUsage = new Response.Usage({
  inputTokens: { uncached: undefined, total: undefined, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: undefined, text: undefined, reasoning: undefined }
})

const observedUsage = new Response.Usage({
  inputTokens: { uncached: 14, total: 17, cacheRead: 3, cacheWrite: undefined },
  outputTokens: { total: 12, text: 5, reasoning: 7 }
})

describe("Module.react", () => {
  it.effect("retains observed usage across tool execution, parse failure, and the final answer", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const toolkitCalls = yield* Ref.make(Arr.empty<string>())
      const tools = Toolkit.make(LookupFacts)
      const toolkit = yield* tools.pipe(Effect.provide(tools.toLayer({
        LookupFacts: ({ question }) => Ref.update(toolkitCalls, Arr.append(question)).pipe(Effect.as(question))
      })))
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fromFunction((prompt) =>
          Trace.observeUsage(observedUsage).pipe(
            Effect.as(
              Match.value(prompt).pipe(
                Match.when(
                  Str.includes("Iteration 2 did not produce parseable output."),
                  () => "[[ ## answer ## ]]\nParis"
                ),
                Match.when(Str.includes("Tool observations:"), () => "malformed"),
                Match.orElse(() =>
                  Arr.make(
                    Response.TextPart.make({ text: "Thought: I should use a tool before answering.", metadata: {} }),
                    Response.toolCallPart({
                      id: "call-1",
                      name: "LookupFacts",
                      params: { question: "What is the capital of France?" },
                      providerExecuted: false
                    }),
                    Response.FinishPart.make({ reason: "stop", usage: emptyUsage, metadata: {} })
                  )
                )
              )
            )
          )
        )
      )
      const react = yield* Module.react(
        new Module.ReactOptions({
          name: "qa-react",
          signature: qa,
          toolkit,
          maxIterations: 5
        })
      )

      const [[[output, entries], calls], aggregate] = yield* Trace.withUsageTracking(
        Trace.withCalls(Trace.withTracing(react.forward({ question: "What is the capital of France?" })))
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      const lmCalls = yield* Ref.get(mock.calls)
      const toolCalls = yield* Ref.get(toolkitCalls)
      const first = Option.getOrThrow(Arr.head(entries))
      const second = Option.getOrThrow(Arr.get(entries, 1))
      const last = Option.getOrThrow(Arr.last(entries))

      expect(output).toEqual({ answer: "Paris" })
      expect(toolCalls).toEqual(Arr.make("What is the capital of France?"))
      expect(Arr.map(lmCalls, (call) => call.method)).toEqual(Arr.make("generateText", "generateText", "generateText"))
      expect(Arr.map(entries, (entry) => entry.outcome)).toEqual(Arr.make("intermediate", "intermediate", "completed"))
      expect(first.rawResponse).toContain("Thought")
      expect(second.prompt).toContain("Tool observations")
      expect(second.rawResponse).toBe("malformed")
      const toolOutput = yield* decode(Trace.UnparsedOutput, first.output)
      const failedOutput = yield* decode(Trace.UnparsedOutput, second.output)
      expect(toolOutput.toolCallCount).toBe(1)
      expect(toolOutput.toolResultCount).toBe(1)
      expect(toolOutput.parseError).toEqual(Option.none())
      expect(failedOutput.response).toBe("malformed")
      expect(failedOutput.toolCallCount).toBe(0)
      expect(failedOutput.toolResultCount).toBe(0)
      expect(Option.isSome(failedOutput.parseError)).toBe(true)
      expect(yield* decode(qa.outputSchema, last.output)).toEqual({ answer: "Paris" })
      expect(last.prompt).toContain("Parse feedback:")
      expect(Arr.map(entries, (entry) => entry.usage)).toEqual(Arr.make(observedUsage, observedUsage, observedUsage))
      expect(Arr.map(calls, (call) => call.usage)).toEqual(
        Arr.make(Option.some(observedUsage), Option.some(observedUsage), Option.some(observedUsage))
      )
      expect(aggregate.callCount).toBe(3)
      expect(aggregate.tokens.inputTokens.total).toBe(51)
      expect(aggregate.tokens.outputTokens.total).toBe(36)
    }))
})
