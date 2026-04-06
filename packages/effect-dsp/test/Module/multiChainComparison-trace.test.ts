/**
 * Module.multiChainComparison trace contracts.
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

const yieldsForRollout = (rollout: number) => 3 - rollout

describe("Module.multiChainComparison trace surface", () => {
  it.effect("keeps candidate lineage and final comparison verdict stable in trace order even under concurrency", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const lm = yield* MockLanguageModel.make(
        MockLanguageModel.fromFunction(() =>
          FiberRef.get(RolloutRef).pipe(
            Effect.flatMap((rollout) =>
              Option.match(rollout, {
                onNone: () =>
                  Effect.succeed({
                    reasoning: "Candidate 2 stays most grounded.",
                    answer: "Candidate 2"
                  }),
                onSome: (value) =>
                  Effect.forEach(Arr.range(0, yieldsForRollout(value) - 1), () => Effect.yieldNow(), { discard: true })
                    .pipe(
                      Effect.as({
                        reasoning: `Candidate ${value + 1} reasoning`,
                        answer: `Candidate ${value + 1}`
                      })
                    )
              })
            )
          )
        )
      )
      const module = yield* Module.multiChainComparison({
        name: "qa-multi-chain-trace",
        signature,
        candidateCount: 3,
        concurrency: 3,
        seed: 0
      })

      const traced = yield* Trace.withTracing(
        module.forward({ question: "Trace ordering question" }).pipe(
          Effect.provide(Layer.succeed(LanguageModel.LanguageModel, lm.service))
        )
      )
      const entries = traced[1]
      const moduleNames = entries.map((entry) => entry.moduleName)
      const compareEntry = entries[3]

      expect(moduleNames).toStrictEqual([
        "qa-multi-chain-trace-candidate-1",
        "qa-multi-chain-trace-candidate-2",
        "qa-multi-chain-trace-candidate-3",
        "qa-multi-chain-trace-compare"
      ])
      expect(Record.keys(entries[0]?.output ?? {})).toStrictEqual(["reasoning", "answer"])
      expect(Record.keys(compareEntry?.input ?? {})).toContain("candidate_comparisons")
      expect(String(compareEntry?.input.candidate_comparisons ?? "")).toContain("Candidate 1")
      expect(String(compareEntry?.input.candidate_comparisons ?? "")).toContain("answer: Candidate 2")
      expect(Record.keys(compareEntry?.output ?? {})).toStrictEqual(["reasoning", "answer"])
      expect(traced[0]).toStrictEqual({ answer: "Candidate 2" })
    }))
})
