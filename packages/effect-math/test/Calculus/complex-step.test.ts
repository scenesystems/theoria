import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array, Effect, Match, Number, Schema } from "effect"

import * as Calculus from "../../src/Calculus.js"
import * as Complex from "../../src/Complex.js"
import * as Numeric from "../../src/Numeric.js"
import * as Policy from "../../src/Policy.js"
import { ComplexArithmeticParityFixtureSchema, loadFixture } from "../helpers/fixtures/index.js"

const DerivativeName = Schema.Literal("square", "cube", "sin", "cos", "exp")

const strict = Policy.layerDeterministic({
  seed: Policy.Seed.make(42),
  precision: "strict",
  backend: "compensated",
  diagnostics: "disabled"
})

const resolve = (name: "square" | "cube" | "sin" | "cos" | "exp") =>
  Match.value(name).pipe(
    Match.when("square", () => (z: Complex.Complex) => Complex.multiply(z, z)),
    Match.when("cube", () => (z: Complex.Complex) => Complex.multiply(z, Complex.multiply(z, z))),
    Match.when("sin", () => Complex.sin),
    Match.when("cos", () => Complex.cos),
    Match.when("exp", () => Complex.exp),
    Match.exhaustive
  )

describe("Calculus / complex-step differentiation", () => {
  it.effect("matches all complex-step SciPy fixtures", () =>
    Effect.gen(function*() {
      const raw = yield* loadFixture("complex.arithmetic-parity")
      const fixture = yield* Schema.decodeUnknown(ComplexArithmeticParityFixtureSchema)(raw, {
        onExcessProperty: "error"
      })

      yield* Effect.forEach(Array.fromIterable(fixture.payload.cases), (c) =>
        Match.value(c).pipe(
          Match.when({ operation: "complexDerivative" }, (value) =>
            Effect.gen(function*() {
              const name = yield* Schema.decodeUnknown(DerivativeName)(value.input.fn)
              expect(
                Numeric.abs(Number.subtract(Calculus.complexStep(resolve(name), value.input.x), value.expected))
              ).toBeLessThanOrEqual(1e-12)
            })),
          Match.orElse(() => Effect.void)
        ))
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("decodes the canonical input and captures callback failures", () =>
    Effect.gen(function*() {
      const value = yield* Calculus.complexStepValidated(
        (z) => Complex.multiply(z, z),
        { x: 3 }
      )
      expect(value).toBeCloseTo(6, 14)

      const error = yield* Effect.flip(Calculus.complexStepValidated(
        () => Schema.decodeUnknownSync(Complex.Complex)("invalid"),
        { x: 3 }
      ))
      expect(error._tag).toStrictEqual("KernelExecutionError")
      expect(error.operation).toStrictEqual("complexStep")
    }))

  it.effect("applies strict runtime policy to finite estimates", () =>
    Effect.gen(function*() {
      const value = yield* Calculus.complexStepWithPolicies((z) => Complex.multiply(z, z), 3)
      expect(value).toBeCloseTo(6, 14)
    }).pipe(Effect.provide(strict)))
})
