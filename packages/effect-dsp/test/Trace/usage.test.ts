/**
 * Usage and cache-key trace contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option, Schema } from "effect"
import * as Contracts from "effect-dsp/contracts"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"
import * as Trace from "effect-dsp/Trace"
import fc from "fast-check"

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

const usageSampleArbitrary = fc.record({
  inputTokens: fc.option(fc.integer({ min: 0, max: 1_000 }), { nil: null }),
  outputTokens: fc.option(fc.integer({ min: 0, max: 1_000 }), { nil: null }),
  cached: fc.boolean()
})

describe("Trace usage", () => {
  it.effect("accumulates call counters inside withUsageTracking scope", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const module = yield* Module.predict("qa", qa)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "Paris" })
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const tracked = yield* Trace.withUsageTracking(
        module.forward({ question: "What is the capital of France?" }).pipe(
          Effect.provide(lmLayer)
        )
      )

      const usage = tracked[1]

      expect(usage.callCount).toBe(1)
      expect(usage.cachedCount).toBe(0)
      expect(usage.inputTokens).toBe(0)
      expect(usage.outputTokens).toBe(0)
    }))

  it.effect("avoids double counting under nested usage-tracking scopes", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const module = yield* Module.predict("qa", qa)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "Paris" })
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const nested = yield* Trace.withUsageTracking(
        Trace.withUsageTracking(
          module.forward({ question: "What is the capital of France?" }).pipe(
            Effect.provide(lmLayer)
          )
        )
      )

      const innerUsage = nested[0][1]
      const outerUsage = nested[1]

      expect(innerUsage.callCount).toBe(1)
      expect(outerUsage.callCount).toBe(1)
      expect(innerUsage.cachedCount).toBe(0)
      expect(outerUsage.cachedCount).toBe(0)
    }))

  it.effect("accumulates usage monotonically from canonical usage samples", () =>
    Effect.sync(() =>
      fc.assert(
        fc.property(fc.array(usageSampleArbitrary, { maxLength: 32 }), (samples) => {
          const folded = samples.reduce(
            (state, sample) => {
              const next = Contracts.accumulateUsage(
                state.previous,
                new Contracts.UsageSample({
                  inputTokens: Option.fromNullable(sample.inputTokens),
                  outputTokens: Option.fromNullable(sample.outputTokens),
                  cached: sample.cached
                })
              )

              return {
                previous: next,
                monotonic: state.monotonic &&
                  next.inputTokens >= state.previous.inputTokens &&
                  next.outputTokens >= state.previous.outputTokens &&
                  next.callCount >= state.previous.callCount &&
                  next.cachedCount >= state.previous.cachedCount
              }
            },
            { previous: Contracts.emptyUsage, monotonic: true }
          )

          return (
            folded.monotonic &&
            folded.previous.callCount === samples.length &&
            folded.previous.cachedCount <= folded.previous.callCount
          )
        })
      )
    ))

  it.effect("records stable optimization fields on trace entries", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const module = yield* Module.predict("qa", qa)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "Paris" })
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const traced = yield* Trace.withTracing(
        module.forward({ question: "What is the capital of France?" }).pipe(
          Effect.provide(lmLayer)
        )
      )

      const entry = traced[1][0]

      expect(entry).toBeDefined()

      if (entry) {
        expect(entry.prompt.length > 0).toBe(true)
        expect(entry.rawResponse.length > 0).toBe(true)
        expect(typeof entry.durationMs).toBe("number")
        expect(Option.isSome(entry.outputTokens) || Option.isNone(entry.outputTokens)).toBe(true)
      }
    }))
})
