/**
 * Stable log-sum-exp over dense immutable chunks.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Chunk, Match, Number } from "effect"

import * as Binary from "./binary.js"
import { sumPairwise } from "./reduction.js"
import { exp, log } from "./transcendental.js"

/** Returns `log(Σ exp(xᵢ))`, or negative infinity for an empty chunk. */
export const logSumExpChunk = (values: Chunk.Chunk<number>): number =>
  Boolean.match(Chunk.some(values, Binary.isNaN), {
    onTrue: () => Binary.notANumber,
    onFalse: () =>
      Boolean.match(
        Chunk.some(values, (value) => Number.Equivalence(value, Binary.positiveInfinity)),
        {
          onTrue: () => Binary.positiveInfinity,
          onFalse: () =>
            Match.value(Chunk.size(values)).pipe(
              Match.when(0, () => Binary.negativeInfinity),
              Match.when(1, () => Chunk.getUnsafe(values, 0)),
              Match.orElse(() => {
                const maximum = Chunk.reduce(values, Binary.negativeInfinity, Number.max)
                return Match.value(maximum).pipe(
                  Match.when(
                    (maximum) => Number.Equivalence(maximum, Binary.negativeInfinity),
                    () => Binary.negativeInfinity
                  ),
                  Match.orElse((maximum) =>
                    Number.sum(
                      maximum,
                      log(sumPairwise(Chunk.map(
                        values,
                        (value) => exp(Number.subtract(value, maximum))
                      )))
                    )
                  )
                )
              })
            )
        }
      )
  })
