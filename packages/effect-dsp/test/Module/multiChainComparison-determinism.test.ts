/**
 * Module.multiChainComparison determinism contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, FiberRef, Layer, Option, Record, Schema } from "effect"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"
import * as Trace from "effect-dsp/Trace"
import { RolloutRef } from "../../src/Cache/refs.js"

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

const buildMock = () =>
  MockLanguageModel.make(
    MockLanguageModel.fromFunction(() =>
      FiberRef.get(RolloutRef).pipe(
        Effect.flatMap((rollout) =>
          Option.match(rollout, {
            onNone: () =>
              Effect.succeed({
                reasoning: "Candidate 9 remains the clearest answer.",
                answer: "Candidate 9"
              }),
            onSome: (value) =>
              Effect.forEach(Arr.range(0, 11 - value), () => Effect.yieldNow(), { discard: true }).pipe(
                Effect.as({
                  reasoning: `Candidate ${value} reasoning`,
                  answer: `Candidate ${value}`
                })
              )
          })
        )
      )
    )
  )

const normalizeTrace = (entries: ReadonlyArray<Trace.Entry>) =>
  entries.map((entry) => ({
    moduleName: entry.moduleName,
    inputKeys: Record.keys(entry.input),
    outputKeys: Record.keys(entry.output),
    rawResponse: entry.rawResponse
  }))

describe("Module.multiChainComparison determinism", () => {
  it.effect("reproduces candidate ordering, comparison verdict, and final answer for fixed seed, candidate count, and concurrency", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()

      const runOnce = () =>
        Effect.gen(function*() {
          const lm = yield* buildMock()
          const module = yield* Module.multiChainComparison({
            name: "qa-multi-chain-determinism",
            signature,
            candidateCount: 3,
            concurrency: 3,
            seed: 8
          })

          return yield* Module.withDiscoveryScope(
            Trace.withTracing(
              module.forward({ question: "Determinism question" }).pipe(
                Effect.provide(Layer.succeed(LanguageModel.LanguageModel, lm.service))
              )
            )
          )
        })

      const firstRun = yield* runOnce()
      const secondRun = yield* runOnce()

      expect(firstRun[0]).toStrictEqual(secondRun[0])
      expect(normalizeTrace(firstRun[1])).toStrictEqual(normalizeTrace(secondRun[1]))
    }))
})
