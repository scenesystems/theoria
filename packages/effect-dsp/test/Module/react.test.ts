/**
 * Module.react contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import * as Response from "@effect/ai/Response"
import * as Tool from "@effect/ai/Tool"
import type * as Toolkit from "@effect/ai/Toolkit"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Ref, Schema } from "effect"
import * as Module from "effect-dsp/Module"
import { MockLanguageModel } from "effect-dsp/test"
import * as Trace from "effect-dsp/Trace"
import { conciseFactsQaSignature } from "../helpers/qa-signatures.js"

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

const LookupFactsToolkit = {
  make: ({
    callsRef
  }: {
    callsRef: Ref.Ref<ReadonlyArray<string>>
  }): Toolkit.WithHandler<{ readonly LookupFacts: typeof LookupFacts }> => ({
    tools: {
      LookupFacts
    },
    handle: (_name, params) => {
      const result: Tool.HandlerResult<typeof LookupFacts> = {
        isFailure: false,
        result: String(params.question),
        encodedResult: String(params.question)
      }

      return Ref.update(callsRef, (entries) => Arr.append(entries, params.question)).pipe(
        Effect.as(result)
      )
    }
  })
}

describe("Module.react", () => {
  it.effect("iterates tool-using thought/action steps until final parseable output and records each step in trace", () =>
    Effect.gen(function*() {
      const qa = yield* conciseFactsQaSignature
      const toolkitCalls = yield* Ref.make<ReadonlyArray<string>>([])
      const toolkit = LookupFactsToolkit.make({ callsRef: toolkitCalls })
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          Arr.make(
            Response.textPart({
              text: "Thought: I should use a tool before answering.",
              metadata: {}
            }),
            Response.toolCallPart({
              id: "call-1",
              name: "LookupFacts",
              params: {
                question: "What is the capital of France?"
              },
              providerExecuted: false,
              metadata: {}
            }),
            Response.finishPart({
              reason: "stop",
              usage: emptyUsage,
              metadata: {}
            })
          ),
          "[[ ## answer ## ]]\nParis"
        ])
      )
      const react = yield* Module.react({
        name: "qa-react",
        signature: qa,
        toolkit,
        maxIterations: 5
      })

      const traced = yield* Trace.withTracing(
        react.forward({ question: "What is the capital of France?" }).pipe(
          Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
        )
      )

      const output = traced[0]
      const entries = traced[1]
      const lmCalls = yield* Ref.get(mock.calls)
      const toolCalls = yield* Ref.get(toolkitCalls)

      expect(output).toEqual({ answer: "Paris" })
      expect(toolCalls).toEqual(["What is the capital of France?"])
      expect(entries).toHaveLength(2)
      expect(lmCalls).toHaveLength(2)
      expect(lmCalls[0]?.method).toBe("generateText")
      expect(lmCalls[1]?.method).toBe("generateText")
      expect(entries[0]?.rawResponse).toContain("Thought")
      expect(entries[1]?.prompt).toContain("Tool observations")
    }))
})
