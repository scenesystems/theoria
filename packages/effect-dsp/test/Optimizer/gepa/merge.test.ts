/**
 * GEPA merge and crossover contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Schema } from "effect"
import {
  findNearestCommonAncestor,
  prepareCommonAncestorMerge,
  recordAcceptedMerge,
  selectBalancedMergeSubsample
} from "../../../src/optimizers/GEPA/merge.js"
import {
  MergeComparison,
  MergeState,
  PredictorInstruction,
  ProgramCandidate
} from "../../../src/optimizers/GEPA/model.js"
import {
  GepaMergeCommonAncestorCasesFixtureSchema,
  GepaMergeScheduleFixtureSchema,
  loadFixture
} from "../../helpers/dspy-fixtures/index.js"

const findInstruction = (
  candidate: ProgramCandidate,
  predictorName: string
): Option.Option<string> =>
  Arr.findFirst(
    candidate.predictorInstructions,
    (entry) => entry.predictorName === predictorName
  ).pipe(Option.map((entry) => entry.instruction))

describe("GEPA merge/crossover", () => {
  it.effect("uses committed fixture contracts for common-ancestor discovery and merge scheduling", () =>
    Effect.gen(function*() {
      const rawCommonAncestorFixture = yield* loadFixture("dspy.gepa.merge.common-ancestor-cases")
      const commonAncestorFixture = yield* Schema.decodeUnknown(GepaMergeCommonAncestorCasesFixtureSchema)(
        rawCommonAncestorFixture
      )
      const rawScheduleFixture = yield* loadFixture("dspy.gepa.merge.schedule.max-merge-invocations")
      const scheduleFixture = yield* Schema.decodeUnknown(GepaMergeScheduleFixtureSchema)(rawScheduleFixture)
      const candidates = Arr.map(
        commonAncestorFixture.payload.candidates,
        (candidate) =>
          new ProgramCandidate({
            candidateId: candidate.candidateId,
            parentIds: candidate.parentIds,
            predictorInstructions: Arr.map(
              candidate.predictorInstructions,
              (instruction) => new PredictorInstruction(instruction)
            )
          })
      )
      const comparisons = Arr.map(
        commonAncestorFixture.payload.comparisons,
        (comparison) => new MergeComparison(comparison)
      )
      const preparation = prepareCommonAncestorMerge({
        candidates,
        parentAId: commonAncestorFixture.payload.parentAId,
        parentBId: commonAncestorFixture.payload.parentBId,
        parentAScore: 0.8,
        parentBScore: 0.7,
        mergedCandidateId: "fixture-merge",
        comparisons,
        mergeBudgetRemaining: scheduleFixture.payload.defaultMaxMergeInvocations,
        seed: commonAncestorFixture.payload.seed
      })

      expect(preparation.event).toEqual({
        _tag: "MergePrepared",
        parentAId: commonAncestorFixture.payload.parentAId,
        parentBId: commonAncestorFixture.payload.parentBId,
        commonAncestorId: commonAncestorFixture.payload.expectedCommonAncestorId
      })
      expect(Arr.map(preparation.subsample, (comparison) => comparison.exampleId)).toEqual(
        commonAncestorFixture.payload.expectedBalancedSubsampleIds
      )

      yield* Effect.forEach(
        scheduleFixture.payload.attemptDecisions,
        (decision) =>
          Effect.sync(() => {
            const shouldAttempt = decision.lastIterationFoundNew && decision.mergeBudgetRemaining > 0 &&
              decision.candidateCount >= 2
            expect(shouldAttempt).toBe(decision.expectedShouldAttempt)
          }),
        { discard: true }
      )

      yield* Effect.forEach(
        scheduleFixture.payload.acceptedMergeBudgetTransitions,
        (transition) =>
          Effect.sync(() => {
            const updated = recordAcceptedMerge(
              new MergeState({
                candidates,
                mergeBudgetRemaining: transition.before
              }),
              new ProgramCandidate({
                candidateId: "accepted-fixture-merge",
                parentIds: Arr.make("parent-a", "parent-b"),
                predictorInstructions: Arr.make(
                  new PredictorInstruction({ predictorName: "qa", instruction: "fixture-qa" })
                )
              })
            )

            expect(updated.mergeBudgetRemaining).toBe(transition.after)
          }),
        { discard: true }
      )
    }))

  it.effect("skips merge with an explicit event when no common ancestor exists", () =>
    Effect.gen(function*() {
      const candidates = Arr.make(
        ProgramCandidate.make({
          candidateId: "root-a",
          parentIds: [],
          predictorInstructions: Arr.make(
            PredictorInstruction.make({ predictorName: "qa", instruction: "root-a" }),
            PredictorInstruction.make({ predictorName: "judge", instruction: "root-a" })
          )
        }),
        ProgramCandidate.make({
          candidateId: "a1",
          parentIds: Arr.make("root-a"),
          predictorInstructions: Arr.make(
            PredictorInstruction.make({ predictorName: "qa", instruction: "a1" }),
            PredictorInstruction.make({ predictorName: "judge", instruction: "a1" })
          )
        }),
        ProgramCandidate.make({
          candidateId: "root-b",
          parentIds: [],
          predictorInstructions: Arr.make(
            PredictorInstruction.make({ predictorName: "qa", instruction: "root-b" }),
            PredictorInstruction.make({ predictorName: "judge", instruction: "root-b" })
          )
        }),
        ProgramCandidate.make({
          candidateId: "b1",
          parentIds: Arr.make("root-b"),
          predictorInstructions: Arr.make(
            PredictorInstruction.make({ predictorName: "qa", instruction: "b1" }),
            PredictorInstruction.make({ predictorName: "judge", instruction: "b1" })
          )
        })
      )

      const preparation = prepareCommonAncestorMerge({
        candidates,
        parentAId: "a1",
        parentBId: "b1",
        parentAScore: 0.6,
        parentBScore: 0.5,
        mergedCandidateId: "merge-ab",
        comparisons: Arr.empty<MergeComparison>(),
        mergeBudgetRemaining: 3,
        seed: 11
      })

      expect(preparation.event._tag).toBe("MergeSkippedNoCommonAncestor")
      expect(preparation.candidate).toEqual(Option.none())
      expect(preparation.subsample).toEqual([])
    }))

  it.effect("selects the nearest discoverable common ancestor across branched lineage", () =>
    Effect.gen(function*() {
      const candidates = Arr.make(
        ProgramCandidate.make({
          candidateId: "root",
          parentIds: [],
          predictorInstructions: Arr.make(
            PredictorInstruction.make({ predictorName: "qa", instruction: "root" }),
            PredictorInstruction.make({ predictorName: "judge", instruction: "root" })
          )
        }),
        ProgramCandidate.make({
          candidateId: "distant",
          parentIds: Arr.make("root"),
          predictorInstructions: Arr.make(
            PredictorInstruction.make({ predictorName: "qa", instruction: "distant" }),
            PredictorInstruction.make({ predictorName: "judge", instruction: "distant" })
          )
        }),
        ProgramCandidate.make({
          candidateId: "close",
          parentIds: Arr.make("root"),
          predictorInstructions: Arr.make(
            PredictorInstruction.make({ predictorName: "qa", instruction: "close" }),
            PredictorInstruction.make({ predictorName: "judge", instruction: "close" })
          )
        }),
        ProgramCandidate.make({
          candidateId: "branch-a",
          parentIds: Arr.make("distant"),
          predictorInstructions: Arr.make(
            PredictorInstruction.make({ predictorName: "qa", instruction: "branch-a" }),
            PredictorInstruction.make({ predictorName: "judge", instruction: "branch-a" })
          )
        }),
        ProgramCandidate.make({
          candidateId: "parent-a",
          parentIds: Arr.make("branch-a", "close"),
          predictorInstructions: Arr.make(
            PredictorInstruction.make({ predictorName: "qa", instruction: "qa-parent-a" }),
            PredictorInstruction.make({ predictorName: "judge", instruction: "judge-parent-a" })
          )
        }),
        ProgramCandidate.make({
          candidateId: "parent-b",
          parentIds: Arr.make("close"),
          predictorInstructions: Arr.make(
            PredictorInstruction.make({ predictorName: "qa", instruction: "qa-parent-b" }),
            PredictorInstruction.make({ predictorName: "judge", instruction: "judge-parent-b" })
          )
        })
      )

      const nearest = findNearestCommonAncestor(candidates, "parent-a", "parent-b")
      const preparation = prepareCommonAncestorMerge({
        candidates,
        parentAId: "parent-a",
        parentBId: "parent-b",
        parentAScore: 0.7,
        parentBScore: 0.6,
        mergedCandidateId: "merged-close",
        comparisons: Arr.empty<MergeComparison>(),
        mergeBudgetRemaining: 4,
        seed: 19
      })

      expect(nearest).toEqual(Option.some("close"))
      expect(preparation.event).toEqual({
        _tag: "MergePrepared",
        parentAId: "parent-a",
        parentBId: "parent-b",
        commonAncestorId: "close"
      })
    }))

  it.effect("selects a deterministic balanced subsample of exactly five examples with fallback policy", () =>
    Effect.gen(function*() {
      const comparisons = Arr.make(
        new MergeComparison({ exampleId: "e-1", parentAScore: 0.9, parentBScore: 0.1 }),
        new MergeComparison({ exampleId: "e-2", parentAScore: 0.8, parentBScore: 0.2 }),
        new MergeComparison({ exampleId: "e-3", parentAScore: 0.7, parentBScore: 0.3 }),
        new MergeComparison({ exampleId: "e-4", parentAScore: 0.6, parentBScore: 0.4 }),
        new MergeComparison({ exampleId: "e-5", parentAScore: 0.55, parentBScore: 0.45 }),
        new MergeComparison({ exampleId: "e-6", parentAScore: 0.65, parentBScore: 0.35 }),
        new MergeComparison({ exampleId: "e-7", parentAScore: 0.2, parentBScore: 0.8 }),
        new MergeComparison({ exampleId: "e-8", parentAScore: 0.5, parentBScore: 0.5 })
      )

      const selectedA = selectBalancedMergeSubsample(comparisons, 42)
      const selectedB = selectBalancedMergeSubsample(comparisons, 42)
      const selectedIds = Arr.map(selectedA, (entry) => entry.exampleId)
      const uniqueIds = Arr.reduce(
        selectedIds,
        Arr.empty<string>(),
        (acc, id) =>
          Arr.some(acc, (knownId) => knownId === id)
            ? acc
            : Arr.append(acc, id)
      )

      expect(selectedA.length).toBe(5)
      expect(selectedA).toEqual(selectedB)
      expect(uniqueIds.length).toBe(selectedA.length)
      expect(Arr.some(selectedA, (entry) => entry.exampleId === "e-7")).toBe(true)
      expect(Arr.some(selectedA, (entry) => entry.exampleId === "e-8")).toBe(true)
    }))

  it.effect("records lineage and decrements merge budget when merge is accepted", () =>
    Effect.gen(function*() {
      const seed = ProgramCandidate.make({
        candidateId: "seed",
        parentIds: [],
        predictorInstructions: Arr.make(
          PredictorInstruction.make({ predictorName: "qa", instruction: "qa-seed" }),
          PredictorInstruction.make({ predictorName: "judge", instruction: "judge-seed" })
        )
      })
      const parentA = ProgramCandidate.make({
        candidateId: "parent-a",
        parentIds: Arr.make("seed"),
        predictorInstructions: Arr.make(
          PredictorInstruction.make({ predictorName: "qa", instruction: "qa-from-a" }),
          PredictorInstruction.make({ predictorName: "judge", instruction: "judge-seed" })
        )
      })
      const parentB = ProgramCandidate.make({
        candidateId: "parent-b",
        parentIds: Arr.make("seed"),
        predictorInstructions: Arr.make(
          PredictorInstruction.make({ predictorName: "qa", instruction: "qa-seed" }),
          PredictorInstruction.make({ predictorName: "judge", instruction: "judge-from-b" })
        )
      })
      const pool = Arr.make(seed, parentA, parentB)
      const preparation = prepareCommonAncestorMerge({
        candidates: pool,
        parentAId: "parent-a",
        parentBId: "parent-b",
        parentAScore: 0.8,
        parentBScore: 0.7,
        mergedCandidateId: "merged-1",
        comparisons: Arr.make(
          new MergeComparison({ exampleId: "e-1", parentAScore: 0.9, parentBScore: 0.2 }),
          new MergeComparison({ exampleId: "e-2", parentAScore: 0.8, parentBScore: 0.3 }),
          new MergeComparison({ exampleId: "e-3", parentAScore: 0.7, parentBScore: 0.4 }),
          new MergeComparison({ exampleId: "e-4", parentAScore: 0.1, parentBScore: 0.9 }),
          new MergeComparison({ exampleId: "e-5", parentAScore: 0.5, parentBScore: 0.5 }),
          new MergeComparison({ exampleId: "e-6", parentAScore: 0.6, parentBScore: 0.4 })
        ),
        mergeBudgetRemaining: 2,
        seed: 7
      })

      expect(preparation.event._tag).toBe("MergePrepared")
      expect(Option.isSome(preparation.candidate)).toBe(true)

      const acceptedCandidate = Option.getOrElse(
        preparation.candidate,
        () =>
          ProgramCandidate.make({
            candidateId: "unreachable",
            parentIds: [],
            predictorInstructions: Arr.make(
              PredictorInstruction.make({ predictorName: "qa", instruction: "unreachable" }),
              PredictorInstruction.make({ predictorName: "judge", instruction: "unreachable" })
            )
          })
      )
      const updatedState = recordAcceptedMerge(
        new MergeState({
          candidates: pool,
          mergeBudgetRemaining: 2
        }),
        acceptedCandidate
      )

      expect(findInstruction(acceptedCandidate, "qa")).toEqual(Option.some("qa-from-a"))
      expect(findInstruction(acceptedCandidate, "judge")).toEqual(Option.some("judge-from-b"))
      expect(acceptedCandidate.parentIds).toEqual(["parent-a", "parent-b"])
      expect(updatedState.mergeBudgetRemaining).toBe(1)
      expect(updatedState.candidates.length).toBe(4)
      expect(Arr.last(updatedState.candidates).pipe(Option.map((candidate) => candidate.candidateId))).toEqual(
        Option.some("merged-1")
      )
    }))
})
