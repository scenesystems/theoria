/**
 * GEPA merge and crossover contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, Number as Num, Option, Schema, String as Str } from "effect"
import {
  classifyMergeComparisonBucket,
  findNearestCommonAncestor,
  prepareCommonAncestorMerge,
  recordAcceptedMerge,
  selectBalancedMergeSubsample
} from "../../src/internal/gepa/merge.js"
import { MergeComparison, MergeState, PredictorInstruction, ProgramCandidate } from "../../src/internal/gepa/model.js"
import {
  GepaMergeCommonAncestorCasesFixtureSchema,
  GepaMergeScheduleFixtureSchema,
  loadFixture
} from "../helpers/dspy-fixtures/index.js"

const makePredictorInstructions = (qa: string, judge: string): ReadonlyArray<PredictorInstruction> =>
  Arr.make(
    new PredictorInstruction({ predictorName: "qa", instruction: qa }),
    new PredictorInstruction({ predictorName: "judge", instruction: judge })
  )

const makeCandidate = (options: {
  readonly id: string
  readonly parentIds?: ReadonlyArray<string>
  readonly qa: string
  readonly judge: string
}): ProgramCandidate =>
  new ProgramCandidate({
    candidateId: options.id,
    parentIds: Option.getOrElse(Option.fromNullable(options.parentIds), Arr.empty<string>),
    predictorInstructions: makePredictorInstructions(options.qa, options.judge)
  })

const findInstruction = (
  candidate: ProgramCandidate,
  predictorName: string
): Option.Option<string> =>
  Arr.findFirst(
    candidate.predictorInstructions,
    (entry) => Str.Equivalence(entry.predictorName, predictorName)
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
            const shouldAttempt = Bool.every(
              Arr.make(
                decision.lastIterationFoundNew,
                Num.greaterThan(decision.mergeBudgetRemaining, 0),
                Num.greaterThanOrEqualTo(decision.candidateCount, 2)
              )
            )
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
        makeCandidate({ id: "root-a", qa: "root-a", judge: "root-a" }),
        makeCandidate({ id: "a1", parentIds: Arr.make("root-a"), qa: "a1", judge: "a1" }),
        makeCandidate({ id: "root-b", qa: "root-b", judge: "root-b" }),
        makeCandidate({ id: "b1", parentIds: Arr.make("root-b"), qa: "b1", judge: "b1" })
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
      expect(preparation.subsample).toEqual(Arr.empty())
    }))

  it.effect("selects the nearest discoverable common ancestor across branched lineage", () =>
    Effect.gen(function*() {
      const candidates = Arr.make(
        makeCandidate({ id: "root", qa: "root", judge: "root" }),
        makeCandidate({ id: "distant", parentIds: Arr.make("root"), qa: "distant", judge: "distant" }),
        makeCandidate({ id: "close", parentIds: Arr.make("root"), qa: "close", judge: "close" }),
        makeCandidate({ id: "branch-a", parentIds: Arr.make("distant"), qa: "branch-a", judge: "branch-a" }),
        makeCandidate({
          id: "parent-a",
          parentIds: Arr.make("branch-a", "close"),
          qa: "qa-parent-a",
          judge: "judge-parent-a"
        }),
        makeCandidate({ id: "parent-b", parentIds: Arr.make("close"), qa: "qa-parent-b", judge: "judge-parent-b" })
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
          Bool.match(Arr.some(acc, (knownId) => Str.Equivalence(knownId, id)), {
            onFalse: () => Arr.append(acc, id),
            onTrue: () => acc
          })
      )

      expect(Arr.length(selectedA)).toBe(5)
      expect(selectedA).toEqual(selectedB)
      expect(Arr.length(uniqueIds)).toBe(Arr.length(selectedA))
      expect(Arr.some(selectedA, (entry) => Str.Equivalence(entry.exampleId, "e-7"))).toBe(true)
      expect(Arr.some(selectedA, (entry) => Str.Equivalence(entry.exampleId, "e-8"))).toBe(true)
    }))

  it.effect("classifies unordered scores and equal infinities as ties", () =>
    Effect.sync(() => {
      const buckets = Arr.map(
        Arr.make(
          new MergeComparison({ exampleId: "nan-a", parentAScore: Number.NaN, parentBScore: 1 }),
          new MergeComparison({ exampleId: "nan-b", parentAScore: 1, parentBScore: Number.NaN }),
          new MergeComparison({
            exampleId: "positive-infinity",
            parentAScore: Number.POSITIVE_INFINITY,
            parentBScore: Number.POSITIVE_INFINITY
          }),
          new MergeComparison({
            exampleId: "negative-infinity",
            parentAScore: Number.NEGATIVE_INFINITY,
            parentBScore: Number.NEGATIVE_INFINITY
          })
        ),
        classifyMergeComparisonBucket
      )

      expect(buckets).toEqual(Arr.make("tie", "tie", "tie", "tie"))
    }))

  it.effect("uses parent B for unordered merge ranking while preserving finite ties", () =>
    Effect.sync(() => {
      const ancestor = makeCandidate({ id: "root", qa: "root", judge: "root" })
      const parentA = makeCandidate({ id: "parent-a", parentIds: Arr.make("root"), qa: "from-a", judge: "root" })
      const parentB = makeCandidate({ id: "parent-b", parentIds: Arr.make("root"), qa: "from-b", judge: "root" })
      const candidates = Arr.make(ancestor, parentA, parentB)
      const prepare = (parentAScore: number, parentBScore: number) =>
        prepareCommonAncestorMerge({
          candidates,
          parentAId: "parent-a",
          parentBId: "parent-b",
          parentAScore,
          parentBScore,
          mergedCandidateId: "merged",
          comparisons: Arr.empty<MergeComparison>(),
          mergeBudgetRemaining: 1,
          seed: 1
        })
      const instruction = (parentAScore: number, parentBScore: number) =>
        prepare(parentAScore, parentBScore).candidate.pipe(
          Option.flatMap((candidate) => findInstruction(candidate, "qa"))
        )

      expect(instruction(Number.NaN, 1)).toEqual(Option.some("from-b"))
      expect(instruction(1, Number.NaN)).toEqual(Option.some("from-b"))
      expect(instruction(1, 1)).toEqual(Option.some("from-a"))
    }))

  it.effect("records lineage and decrements merge budget when merge is accepted", () =>
    Effect.gen(function*() {
      const seed = makeCandidate({ id: "seed", qa: "qa-seed", judge: "judge-seed" })
      const parentA = makeCandidate({
        id: "parent-a",
        parentIds: Arr.make("seed"),
        qa: "qa-from-a",
        judge: "judge-seed"
      })
      const parentB = makeCandidate({
        id: "parent-b",
        parentIds: Arr.make("seed"),
        qa: "qa-seed",
        judge: "judge-from-b"
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
        () => makeCandidate({ id: "unreachable", qa: "unreachable", judge: "unreachable" })
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
      expect(acceptedCandidate.parentIds).toEqual(Arr.make("parent-a", "parent-b"))
      expect(updatedState.mergeBudgetRemaining).toBe(1)
      expect(Arr.length(updatedState.candidates)).toBe(4)
      expect(Arr.last(updatedState.candidates).pipe(Option.map((candidate) => candidate.candidateId))).toEqual(
        Option.some("merged-1")
      )
    }))
})
