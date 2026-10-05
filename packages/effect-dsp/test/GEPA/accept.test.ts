/**
 * GEPA acceptance-gate contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num, Option, Ref } from "effect"
import {
  evaluateMergeAcceptance,
  evaluateMutationAcceptance,
  EvaluateMutationAcceptanceOptions
} from "../../src/internal/gepa/accept.js"

describe("GEPA acceptance gates", () => {
  it.effect("enforces strict mutation gate 1 (`newSum > oldSum`) and rejects equality", () =>
    Effect.gen(function*() {
      const result = yield* evaluateMutationAcceptance(
        new EvaluateMutationAcceptanceOptions({
          previousSubsampleScores: Arr.make(0.4, 0.6),
          mutatedSubsampleScores: Arr.make(0.4, 0.6),
          evaluateFullValset: Effect.succeed(Arr.make(0.9, 1))
        })
      )

      expect(result.gate1Passed).toBe(false)
      expect(result.previousSubsampleSum).toBe(1)
      expect(result.mutatedSubsampleSum).toBe(1)
      expect(result.fullValsetEvaluated).toBe(false)
      expect(result.fullValsetScores).toEqual(Option.none())
      expect(result.fullValsetSum).toEqual(Option.none())
    }))

  it.effect("runs mutation gate 2 full-valset evaluation only when gate 1 passes", () =>
    Effect.gen(function*() {
      const fullEvalCalls = yield* Ref.make(0)
      const evaluateFullValset = Ref.updateAndGet(fullEvalCalls, Num.increment).pipe(
        Effect.as(Arr.make(0.8, 0.9))
      )

      const rejectedAtGate1 = yield* evaluateMutationAcceptance(
        new EvaluateMutationAcceptanceOptions({
          previousSubsampleScores: Arr.make(0.5, 0.5),
          mutatedSubsampleScores: Arr.make(0.5, 0.5),
          evaluateFullValset
        })
      )
      const callsAfterGate1Reject = yield* Ref.get(fullEvalCalls)

      const acceptedAtGate1 = yield* evaluateMutationAcceptance(
        new EvaluateMutationAcceptanceOptions({
          previousSubsampleScores: Arr.make(0.2, 0.3),
          mutatedSubsampleScores: Arr.make(0.4, 0.3),
          evaluateFullValset
        })
      )
      const callsAfterGate1Pass = yield* Ref.get(fullEvalCalls)

      expect(rejectedAtGate1.gate1Passed).toBe(false)
      expect(rejectedAtGate1.fullValsetEvaluated).toBe(false)
      expect(callsAfterGate1Reject).toBe(0)

      expect(acceptedAtGate1.gate1Passed).toBe(true)
      expect(acceptedAtGate1.fullValsetEvaluated).toBe(true)
      expect(acceptedAtGate1.fullValsetScores).toEqual(Option.some(Arr.make(0.8, 0.9)))
      expect(Option.getOrElse(acceptedAtGate1.fullValsetSum, () => 0)).toBeCloseTo(1.7)
      expect(callsAfterGate1Pass).toBe(1)
    }))

  it.effect("accepts merge candidates with non-strict comparator (`mergedSum >= bestParentSum`)", () =>
    Effect.gen(function*() {
      const tieAccepted = evaluateMergeAcceptance({
        mergedSubsampleScores: Arr.make(0.5, 0.4),
        parentASubsampleScores: Arr.make(0.4, 0.5),
        parentBSubsampleScores: Arr.make(0.5, 0.4)
      })
      const worseRejected = evaluateMergeAcceptance({
        mergedSubsampleScores: Arr.make(0.2, 0.3),
        parentASubsampleScores: Arr.make(0.4, 0.4),
        parentBSubsampleScores: Arr.make(0.3, 0.4)
      })

      expect(tieAccepted.accepted).toBe(true)
      expect(tieAccepted.mergedSubsampleSum).toBe(0.9)
      expect(tieAccepted.bestParentSubsampleSum).toBe(0.9)

      expect(worseRejected.accepted).toBe(false)
      expect(worseRejected.mergedSubsampleSum).toBe(0.5)
      expect(worseRejected.bestParentSubsampleSum).toBe(0.8)
    }))
})
