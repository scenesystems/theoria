/**
 * GEPA Pareto frontier invariants.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option } from "effect"
import fc from "fast-check"
import { deriveParetoKernelSnapshot, dominatesCandidateVector } from "../../src/optimizers/GEPA/pareto.js"

const scoreMatrixArbitrary = fc
  .tuple(
    fc.integer({ min: 2, max: 8 }),
    fc.integer({ min: 2, max: 8 })
  )
  .chain(([candidateCount, exampleCount]) =>
    fc.array(
      fc.array(
        fc.double({
          min: 0,
          max: 1,
          noNaN: true,
          noDefaultInfinity: true
        }),
        { minLength: exampleCount, maxLength: exampleCount }
      ),
      { minLength: candidateCount, maxLength: candidateCount }
    )
  )

const scoreVectorAt = (
  scoreMatrix: ReadonlyArray<ReadonlyArray<number>>,
  candidateIndex: number
): ReadonlyArray<number> => Arr.get(scoreMatrix, candidateIndex).pipe(Option.getOrElse(() => Arr.empty<number>()))

describe("GEPA Pareto invariants", () => {
  it.effect("never includes a frontier member dominated by another frontier member", () =>
    Effect.gen(function*() {
      const scoreMatrices = fc.sample(scoreMatrixArbitrary, { numRuns: 80 })

      yield* Effect.forEach(
        scoreMatrices,
        (scoreMatrix) =>
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
        { discard: true }
      )
    }))
})
