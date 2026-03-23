import { describe, expect, it } from "@effect/vitest"
import { Effect, Number as Num, Option, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import { validateNumericBoundary } from "../../src/Numeric/operations.js"

const deterministicTestLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(1337),
  precision: "strict",
  backend: "typed-array",
  diagnostics: "enabled"
})

describe("numeric law scaffolding", () => {
  it.effect("sum semigroup is associative for representative triples", () =>
    Effect.sync(() => {
      const a = 1.25
      const b = -4.5
      const c = 9.75

      const left = Num.sum(Num.sum(a, b), c)
      const right = Num.sum(a, Num.sum(b, c))

      expect(left).toBe(right)
    }))

  it.effect("monoid sum identity holds for representative values", () =>
    Effect.sync(() => {
      expect(Num.sum(0, 0)).toBe(0)
      expect(Num.sum(0, 0)).toBe(0)

      expect(Num.sum(1, 0)).toBe(1)
      expect(Num.sum(0, 1)).toBe(1)

      expect(Num.sum(-1, 0)).toBe(-1)
      expect(Num.sum(0, -1)).toBe(-1)

      expect(Num.sum(3.5, 0)).toBe(3.5)
      expect(Num.sum(0, 3.5)).toBe(3.5)
    }))

  it.effect("bounded clamp keeps values within canonical bounds", () =>
    Effect.sync(() => {
      const between = Num.between({ minimum: -2, maximum: 5 })

      expect(between(Num.clamp(0, { minimum: -2, maximum: 5 }))).toBe(true)
      expect(between(Num.clamp(10, { minimum: -2, maximum: 5 }))).toBe(true)
      expect(between(Num.clamp(-10, { minimum: -2, maximum: 5 }))).toBe(true)
    }))

  it.effect("safe division surfaces Option semantics for undefined boundaries", () =>
    Effect.sync(() => {
      expect(Option.isSome(Num.divide(9, 3))).toBe(true)
      expect(Option.isNone(Num.divide(9, 0))).toBe(true)
    }))

  it.effect("deterministic numeric boundary validation remains stable across repeated invocations", () =>
    Effect.gen(function*() {
      const firstRun = yield* validateNumericBoundary({
        values: [0.1, 0.2, 0.3, 0.4],
        tolerance: 1e-9,
        budget: 64
      })

      const secondRun = yield* validateNumericBoundary({
        values: [0.1, 0.2, 0.3, 0.4],
        tolerance: 1e-9,
        budget: 64
      })

      expect(firstRun).toEqual(secondRun)
    }).pipe(Effect.provide(deterministicTestLayer)))
})
