/**
 * GEPA Task 6.3 acceptance-gate contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Ref, Schema } from "effect"
import { evaluateMergeAcceptance, evaluateMutationAcceptance } from "../../../src/optimizers/GEPA/accept.js"
import {
  GepaAcceptMergeNonStrictFixtureSchema,
  GepaAcceptMutationStrictGreaterFixtureSchema,
  loadFixture
} from "../../helpers/dspy-fixtures/index.js"

describe("GEPA acceptance gates", () => {
  it.effect("evaluates fixture-declared strict mutation acceptance cases", () =>
    Effect.gen(function*() {
      const rawFixture = yield* loadFixture("dspy.gepa.accept.mutation-strict-greater")
      const fixture = yield* Schema.decodeUnknown(GepaAcceptMutationStrictGreaterFixtureSchema)(rawFixture)

      yield* Effect.forEach(
        fixture.payload.cases,
        (testCase) =>
          Effect.gen(function*() {
            const result = yield* evaluateMutationAcceptance({
              previousSubsampleScores: testCase.previousSubsampleScores,
              mutatedSubsampleScores: testCase.mutatedSubsampleScores,
              evaluateFullValset: Effect.succeed(testCase.fullValsetScores)
            })

            expect(result.gate1Passed).toBe(testCase.expectedGate1Passed)
            expect(result.fullValsetEvaluated).toBe(testCase.expectedFullValsetEvaluated)
            expect(result.gate1Passed && Option.isSome(result.fullValsetScores)).toBe(testCase.expectedAccepted)
          }),
        { discard: true }
      )
    }))

  it.effect("enforces strict mutation gate 1 (`newSum > oldSum`) and rejects equality", () =>
    Effect.gen(function*() {
      const result = yield* evaluateMutationAcceptance({
        previousSubsampleScores: [0.4, 0.6],
        mutatedSubsampleScores: [0.4, 0.6],
        evaluateFullValset: Effect.succeed([0.9, 1])
      })

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
      const evaluateFullValset = Ref.updateAndGet(fullEvalCalls, (count) => count + 1).pipe(
        Effect.as([0.8, 0.9])
      )

      const rejectedAtGate1 = yield* evaluateMutationAcceptance({
        previousSubsampleScores: [0.5, 0.5],
        mutatedSubsampleScores: [0.5, 0.5],
        evaluateFullValset
      })
      const callsAfterGate1Reject = yield* Ref.get(fullEvalCalls)

      const acceptedAtGate1 = yield* evaluateMutationAcceptance({
        previousSubsampleScores: [0.2, 0.3],
        mutatedSubsampleScores: [0.4, 0.3],
        evaluateFullValset
      })
      const callsAfterGate1Pass = yield* Ref.get(fullEvalCalls)

      expect(rejectedAtGate1.gate1Passed).toBe(false)
      expect(rejectedAtGate1.fullValsetEvaluated).toBe(false)
      expect(callsAfterGate1Reject).toBe(0)

      expect(acceptedAtGate1.gate1Passed).toBe(true)
      expect(acceptedAtGate1.fullValsetEvaluated).toBe(true)
      expect(acceptedAtGate1.fullValsetScores).toEqual(Option.some([0.8, 0.9]))
      expect(Option.getOrElse(acceptedAtGate1.fullValsetSum, () => 0)).toBeCloseTo(1.7)
      expect(callsAfterGate1Pass).toBe(1)
    }))

  it.effect("accepts merge candidates with non-strict comparator (`mergedSum >= bestParentSum`)", () =>
    Effect.gen(function*() {
      const rawFixture = yield* loadFixture("dspy.gepa.accept.merge-non-strict")
      const fixture = yield* Schema.decodeUnknown(GepaAcceptMergeNonStrictFixtureSchema)(rawFixture)
      const tieAccepted = evaluateMergeAcceptance({
        mergedSubsampleScores: [0.5, 0.4],
        parentASubsampleScores: [0.4, 0.5],
        parentBSubsampleScores: [0.5, 0.4]
      })
      const worseRejected = evaluateMergeAcceptance({
        mergedSubsampleScores: [0.2, 0.3],
        parentASubsampleScores: [0.4, 0.4],
        parentBSubsampleScores: [0.3, 0.4]
      })

      expect(tieAccepted.accepted).toBe(true)
      expect(tieAccepted.mergedSubsampleSum).toBe(0.9)
      expect(tieAccepted.bestParentSubsampleSum).toBe(0.9)

      expect(worseRejected.accepted).toBe(false)
      expect(worseRejected.mergedSubsampleSum).toBe(0.5)
      expect(worseRejected.bestParentSubsampleSum).toBe(0.8)

      yield* Effect.forEach(
        fixture.payload.cases,
        (testCase) =>
          Effect.sync(() => {
            const result = evaluateMergeAcceptance({
              mergedSubsampleScores: testCase.mergedSubsampleScores,
              parentASubsampleScores: testCase.parentASubsampleScores,
              parentBSubsampleScores: testCase.parentBSubsampleScores
            })

            expect(result.accepted).toBe(testCase.expectedAccepted)
          }),
        { discard: true }
      )
    }))
})
