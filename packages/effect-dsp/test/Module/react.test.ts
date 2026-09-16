/**
 * Module.react contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import * as Response from "@effect/ai/Response"
import * as Tool from "@effect/ai/Tool"
import * as Toolkit from "@effect/ai/Toolkit"
import { describe, expect, it } from "@effect/vitest"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Array as Arr, Effect, Match, Option, Ref, Schema, String as Str } from "effect"

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
  parameters: {
    question: Schema.String
  },
  success: Schema.String
})

const emptyUsage = new Response.Usage({
  inputTokens: undefined,
  outputTokens: undefined,
  totalTokens: undefined,
  reasoningTokens: undefined,
  cachedInputTokens: undefined
})

const observedUsage = new Response.Usage({
  inputTokens: 17,
  outputTokens: 5,
  totalTokens: 29,
  reasoningTokens: 7,
  cachedInputTokens: 3
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
                    Response.textPart({ text: "Thought: I should use a tool before answering." }),
                    Response.toolCallPart({
                      id: "call-1",
                      name: "LookupFacts",
                      params: { question: "What is the capital of France?" },
                      providerExecuted: false
                    }),
                    Response.finishPart({ reason: "stop", usage: emptyUsage })
                  )
                )
              )
            )
          )
        )
      )
      const react = yield* Module.react({
        name: "qa-react",
        signature: qa,
        toolkit,
        maxIterations: 5
      })

      const [[[output, entries], calls], aggregate] = yield* Trace.withUsageTracking(
        Trace.withCalls(Trace.withTracing(react.forward({ question: "What is the capital of France?" })))
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      const lmCalls = yield* Ref.get(mock.calls)
      const toolCalls = yield* Ref.get(toolkitCalls)
      const first = yield* Arr.head(entries)
      const second = yield* Arr.get(entries, 1)
      const last = yield* Arr.last(entries)

      expect(output).toEqual({ answer: "Paris" })
      expect(toolCalls).toEqual(Arr.make("What is the capital of France?"))
      expect(Arr.map(lmCalls, (call) => call.method)).toEqual(Arr.make("generateText", "generateText", "generateText"))
      expect(first.rawResponse).toContain("Thought")
      expect(second.prompt).toContain("Tool observations")
      expect(second.rawResponse).toBe("malformed")
      expect(last.prompt).toContain("Parse feedback:")
      expect(Arr.map(entries, (entry) => entry.usage)).toEqual(Arr.make(observedUsage, observedUsage, observedUsage))
      expect(Arr.map(calls, (call) => call.usage)).toEqual(
        Arr.make(Option.some(observedUsage), Option.some(observedUsage), Option.some(observedUsage))
      )
      expect(aggregate.callCount).toBe(3)
      expect(aggregate.tokens.totalTokens).toBe(87)
    }))
})
