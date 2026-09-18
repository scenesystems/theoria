/**
 * Stable log-sum-exp over dense immutable chunks.
 *
 * @since 0.1.0
 * @category internal
 */
import { Array, Boolean, Chunk, Match, Number } from "effect"

import * as Binary from "./binary.js"
import { exp, log } from "./transcendental.js"

/** Returns `log(Σ exp(xᵢ))`, or negative infinity for an empty chunk. */
export const logSumExpChunk = Match.type<Chunk.Chunk<number>>().pipe(
  Match.when((values) => Number.Equivalence(Chunk.size(values), 1), (values) => Chunk.unsafeGet(values, 0)),
  Match.orElse((values) => {
    const elements = Chunk.toReadonlyArray(values)
    // Effect's total Number.Order is not an IEEE unordered comparison, so
    // propagate NaN explicitly while folding exceptional values into this scan.
    const maximum = Array.reduce(
      elements,
      Binary.negativeInfinity,
      (current, value) =>
        Boolean.match(Boolean.or(Binary.isNaN(value), Binary.isNaN(current)), {
          onTrue: () => Binary.notANumber,
          onFalse: () => Number.max(current, value)
        })
    )
    return Boolean.match(Binary.isFinite(maximum), {
      onFalse: () => maximum,
      onTrue: () =>
        Number.sum(
          maximum,
          log(Array.reduce(elements, 0, (total, value) => Number.sum(total, exp(Number.subtract(value, maximum)))))
        )
    })
  })
)
