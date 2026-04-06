import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Schema } from "effect"
import * as Contracts from "effect-dsp/contracts"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"
import * as Trace from "effect-dsp/Trace"

import { makeFixtureRegistry, MultiChainComparisonFixtureSchema } from "../helpers/dspy-fixtures/index.js"

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with short factual answers",
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )

describe("Module.multiChainComparison evidence surface", () => {
  it.effect("keeps ordered usage totals and optimization projections stable under concurrent candidate execution", () =>
    Effect.gen(function*() {
      const registry = makeFixtureRegistry()
      const rawFixture = yield* registry.load("dspy.multiChainComparison.basic")
      const fixture = yield* Schema.decodeUnknown(MultiChainComparisonFixtureSchema)(rawFixture)

      const qa = yield* makeQaSignature()
      const module = yield* Module.multiChainComparison({
        name: "qa-multi-chain-evidence",
        signature: qa,
        candidateCount: fixture.payload.candidateCount,
        concurrency: fixture.payload.candidateCount,
        seed: 4
      })
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          ...fixture.payload.candidateResponses,
          fixture.payload.compareResponse
        ])
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const execution = yield* Trace.withUsageTracking(
        Trace.withTracing(
          module.forward(fixture.payload.sampleInput).pipe(
            Effect.provide(lmLayer)
          )
        )
      )
      const traces = execution[0][1]
      const usage = execution[1]
      const projections = yield* Effect.forEach(traces, (trace) => Contracts.projectOptimizationObjective(trace))
      const encoded = yield* Effect.forEach(
        projections,
        (projection) => Schema.encode(Contracts.OptimizationObjectiveSurface)(projection)
      )
      const decoded = yield* Effect.forEach(
        encoded,
        (projection) => Schema.decode(Contracts.OptimizationObjectiveSurface)(projection)
      )

      expect(usage.callCount).toBe(fixture.payload.candidateCount + 1)
      expect(usage.cachedCount).toBe(0)
      expect(traces).toHaveLength(fixture.payload.candidateCount + 1)
      expect(projections[fixture.payload.candidateCount]?.output.answer).toBe(fixture.payload.compareResponse.answer)
      expect(decoded).toStrictEqual(projections)
    }))
})
