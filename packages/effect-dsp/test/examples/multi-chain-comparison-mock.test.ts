/**
 * Example contract: mock-backed multi-chain comparison flow.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"
import * as Trace from "effect-dsp/Trace"

describe("examples/17-multi-chain-comparison-mock", () => {
  it.effect("projects a side-by-side candidate comparison into the final verdict trace", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make(
        "Answer questions with short factual answers",
        {
          question: Signature.describe(Schema.String, "The question to answer")
        },
        {
          answer: Signature.describe(Schema.String, "The final answer")
        }
      )
      const comparison = yield* Module.multiChainComparison({
        name: "qa-multi-chain-comparison-example",
        signature,
        candidateCount: 3,
        concurrency: 2,
        seed: 7
      })
      const traced = yield* Trace.withTracing(
        comparison.forward({ question: "Which planet is known as the Red Planet?" }).pipe(
          Effect.provide(
            MockLanguageModel.layer(
              LanguageModel.LanguageModel,
              MockLanguageModel.sequence([
                {
                  reasoning: "Mars is widely called the Red Planet because of iron oxide on its surface.",
                  answer: "Mars"
                },
                {
                  reasoning: "Jupiter has colored bands but is not called the Red Planet.",
                  answer: "Jupiter"
                },
                {
                  reasoning: "Venus is bright in the sky but not the Red Planet.",
                  answer: "Venus"
                },
                {
                  reasoning: "The Mars candidate is the only answer aligned with the question.",
                  answer: "Mars"
                }
              ])
            )
          )
        )
      )
      const result = traced[0]
      const traces = traced[1]

      expect(result).toStrictEqual({ answer: "Mars" })
      expect(traces[3]?.input.candidate_comparisons).toContain("Candidate 1")
      expect(traces[3]?.input.candidate_comparisons).toContain("Mars")
    }))
})
