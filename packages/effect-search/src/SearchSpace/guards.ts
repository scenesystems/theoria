/**
 * Type guards and validators for ensuring values conform to the PrimitiveChoice schema used by categorical dimensions.
 *
 * @since 0.1.0
 */
import { Effect, Match, Option, Schema } from "effect"

import type { PrimitiveChoice } from "../contracts/Distribution.js"
import { PrimitiveChoiceSchema } from "../contracts/Distribution.js"
import type { InvalidSearchSpace } from "../Errors/index.js"
import { expectCondition, invalidSearchSpace } from "./failure.js"

const primitiveChoiceGuard = Schema.is(PrimitiveChoiceSchema)

/**
 * Validates that a value conforms to the PrimitiveChoice schema (string, number, boolean, or null) with finite-number enforcement.
 *
 * @since 0.1.0
 * @category guards
 */
export const ensurePrimitiveChoice = (choice: unknown): Effect.Effect<PrimitiveChoice, InvalidSearchSpace> =>
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
              Number.isFinite(value),
              "categorical number choices must be finite",
              "categorical"
            ).pipe(Effect.as(primitiveChoice))),
          Match.orElse(() => Effect.succeed(primitiveChoice))
        )
    })
  )
