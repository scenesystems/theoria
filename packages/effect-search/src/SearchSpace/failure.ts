/**
 * Internal helpers for constructing InvalidSearchSpace errors and assertion-style condition guards.
 *
 * @since 0.1.0
 */
import { Effect, Option } from "effect"

import { InvalidSearchSpace } from "../Errors/index.js"

/**
 * Constructs an InvalidSearchSpace error with an optional dimension context for diagnostics.
 *
 * @since 0.1.0
 * @category constructors
 */
export const invalidSearchSpace = (reason: string, dimension?: string): InvalidSearchSpace =>
  Option.fromNullable(dimension).pipe(
    Option.match({
      onNone: () => new InvalidSearchSpace({ reason }),
      onSome: (value) => new InvalidSearchSpace({ reason, dimension: value })
    })
  )

/**
 * Fails with InvalidSearchSpace if the condition is false — an assertion-style guard for search space validation.
 *
 * @since 0.1.0
 * @category utils
 */
export const expectCondition = (
  condition: boolean,
  reason: string,
  dimension?: string
): Effect.Effect<void, InvalidSearchSpace> =>
  Effect.filterOrFail(Effect.void, () => condition, () => invalidSearchSpace(reason, dimension))
