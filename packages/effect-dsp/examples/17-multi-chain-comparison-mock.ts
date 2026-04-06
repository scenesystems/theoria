/**
 * Side-by-side reasoning comparison with `Module.multiChainComparison`.
 *
 * Run: bun run examples/17-multi-chain-comparison-mock.ts
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Layer, Schema } from "effect"
import { Module, Signature, Trace } from "effect-dsp"
import { MockLanguageModel } from "effect-dsp/test"

const program = Effect.gen(function*() {
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
    name: "qa-multi-chain-comparison",
    signature,
    candidateCount: 3,
    concurrency: 2,
    seed: 7
  })
  const traced = yield* Trace.withTracing(
    comparison.forward({ question: "Which planet is known as the Red Planet?" }).pipe(
      Effect.provide(
        Layer.succeed(
          LanguageModel.LanguageModel,
          yield* MockLanguageModel.make(
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
          ).pipe(Effect.map((mock) => mock.service))
        )
      )
    )
  )
  const result = traced[0]
  const traces = traced[1]

  yield* Effect.log("multi-chain-comparison-mock", {
    result,
    candidateComparisons: traces[3]?.input.candidate_comparisons
  })
})

BunRuntime.runMain(program)
