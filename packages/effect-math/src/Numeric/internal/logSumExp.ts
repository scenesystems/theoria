/**
 * Stable log-sum-exp over dense immutable chunks.
 *
 * @since 0.1.0
 * @category internal
 */
import { Chunk, Match, Number } from "effect"

import * as Binary from "./binary.js"
import { exp, log } from "./transcendental.js"

/** Returns `log(Σ exp(xᵢ))`, or negative infinity for an empty chunk. */
export const logSumExpChunk = (values: Chunk.Chunk<number>): number =>
  Match.value(values).pipe(
    Match.when((values) => Chunk.some(values, Binary.isNaN), () => Binary.notANumber),
    Match.when(
      (values) => Chunk.some(values, (value) => Number.Equivalence(value, Binary.positiveInfinity)),
      () => Binary.positiveInfinity
    ),
    Match.orElse((values) =>
      Match.value(Chunk.size(values)).pipe(
        Match.when(0, () => Binary.negativeInfinity),
        Match.when(1, () => Chunk.unsafeGet(values, 0)),
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
                log(Chunk.reduce(
                  values,
                  0,
                  (total, value) => Number.sum(total, exp(Number.subtract(value, maximum)))
                ))
              )
            )
          )
        })
      )
    )
  )
