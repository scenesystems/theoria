import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Number, Schema } from "effect"

import * as Numeric from "../../src/Numeric.js"
import { loadFixture, NumericElementaryParityFixtureSchema } from "../helpers/fixtures/index.js"

const evaluate = Match.type<typeof NumericElementaryParityFixtureSchema.Type["payload"]["cases"][number]>().pipe(
  Match.when({ operation: "log" }, (c) => Numeric.log(c.input.x)),
  Match.when({ operation: "log10" }, (c) => Numeric.log10(c.input.x)),
  Match.when({ operation: "sqrt" }, (c) => Numeric.sqrt(c.input.x)),
  Match.when({ operation: "log1p" }, (c) => Numeric.log1p(c.input.x)),
  Match.when({ operation: "exp" }, (c) => Numeric.exp(c.input.x)),
  Match.when({ operation: "expm1" }, (c) => Numeric.expm1(c.input.x)),
  Match.when({ operation: "sin" }, (c) => Numeric.sin(c.input.x)),
  Match.when({ operation: "cos" }, (c) => Numeric.cos(c.input.x)),
  Match.when({ operation: "atan" }, (c) => Numeric.atan2(c.input.x, 1)),
  Match.when({ operation: "sinh" }, (c) => Numeric.sinh(c.input.x)),
  Match.when({ operation: "cosh" }, (c) => Numeric.cosh(c.input.x)),
  Match.exhaustive
)

describe("Numeric binary64 approximation parity", () => {
  it.effect("matches NumPy across exponents, reduction boundaries and tiny residuals", () =>
    Effect.gen(function*() {
      const fixture = yield* Schema.decodeUnknown(NumericElementaryParityFixtureSchema)(
        yield* loadFixture("numeric.elementary-parity"),
        { onExcessProperty: "error" }
      )
      yield* Effect.forEach(fixture.payload.cases, (c) =>
        Effect.sync(() => {
          expect(Numeric.abs(Number.subtract(evaluate(c), c.expected)), c.id).toBeLessThanOrEqual(c.tolerance)
        }))
    }).pipe(Effect.provide(BunContext.layer)))
})
