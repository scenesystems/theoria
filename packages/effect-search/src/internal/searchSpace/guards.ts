/**
 * Type guards and validators for ensuring values conform to the Choice schema used by categorical dimensions.
 *
 * @since 0.1.0
 */
import { isFinite } from "@scenesystems/effect-math/Numeric"
import { Effect, Match, Option, Schema } from "effect"

import { Choice } from "../../Distribution.js"
import type { InvalidSearchSpace } from "../../SearchError.js"
import { expectCondition, invalidSearchSpace } from "./failure.js"

const primitiveChoiceGuard = Schema.is(Choice)

/**
 * Validates that a value conforms to the Choice schema (string, number, boolean, or null) with finite-number enforcement.
 *
 * @since 0.1.0
 * @category guards
 */
export const ensureChoice = (choice: unknown): Effect.Effect<Choice, InvalidSearchSpace> =>
  Option.liftPredicate(primitiveChoiceGuard)(choice).pipe(
    Option.match({
      onNone: () =>
        Effect.fail(
          invalidSearchSpace(
            "categorical choices must be primitives (string | number | boolean | null)",
            "categorical"
          )
        ),
      onSome: (primitiveChoice) =>
        Match.value(primitiveChoice).pipe(
          Match.when(Match.number, (value) =>
            expectCondition(
              isFinite(value),
              "categorical number choices must be finite",
              "categorical"
            ).pipe(Effect.as(primitiveChoice))),
          Match.orElse(() => Effect.succeed(primitiveChoice))
        )
    })
  )
