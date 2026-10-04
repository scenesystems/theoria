/**
 * GEPA Pareto frontier invariants.
 */
import { describe, expect, it } from "@effect/vitest"
import { Arbitrary, Array as Arr, Effect, Option, Schema } from "effect"
import { deriveParetoKernelSnapshot, dominatesCandidateVector } from "../../src/internal/gepa/frontier.js"

const dimensionArbitrary = Arbitrary.schema(
  Schema.Int.check(Schema.isBetween({ minimum: 2, maximum: 8 }))
)
const scoreArbitrary = Arbitrary.schema(
  Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 }))
)
const scoreMatrixArbitrary = Arbitrary.all([dimensionArbitrary, dimensionArbitrary]).pipe(
  Arbitrary.flatMap(([candidateCount, exampleCount]) =>
    Arbitrary.array(
      Arbitrary.array(scoreArbitrary, { minLength: exampleCount, maxLength: exampleCount }),
      { minLength: candidateCount, maxLength: candidateCount }
    )
  )
)

const scoreVectorAt = (
  scoreMatrix: ReadonlyArray<ReadonlyArray<number>>,
  candidateIndex: number
): ReadonlyArray<number> => Arr.get(scoreMatrix, candidateIndex).pipe(Option.getOrElse(() => Arr.empty<number>()))

describe("GEPA Pareto invariants", () => {
  it.effect.prop(
    "never includes a frontier member dominated by another frontier member",
    [scoreMatrixArbitrary],
    ([scoreMatrix]) =>
      Effect.sync(() => {
        const snapshot = deriveParetoKernelSnapshot(scoreMatrix)
        const dominanceViolations = Arr.flatMap(snapshot.frontierIndices, (candidateIndex) =>
          Arr.filter(
            snapshot.frontierIndices,
            (otherIndex) =>
              otherIndex !== candidateIndex &&
              dominatesCandidateVector(
                scoreVectorAt(scoreMatrix, otherIndex),
                scoreVectorAt(scoreMatrix, candidateIndex)
              )
          ))
        expect(dominanceViolations).toEqual([])
      }),
    { arbitrary: { runs: 80 } }
  )
})
