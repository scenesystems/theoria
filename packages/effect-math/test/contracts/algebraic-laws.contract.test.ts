import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import fc from "fast-check"

import type { Complex } from "../../src/Complex/model.js"
import { add, multiply, of, one, zero } from "../../src/Complex/operations.js"
import { assertMonoidLaws } from "../helpers/properties.js"

const complexArbitrary = fc
  .tuple(
    fc.integer({ min: -20, max: 20 }),
    fc.integer({ min: -20, max: 20 })
  )
  .map(([re, im]) => of(re, im))

const complexEquals = (left: Complex, right: Complex): boolean => left.re === right.re && left.im === right.im

describe("algebraic laws", () => {
  it.effect("keeps additive kernels associative with zero as the monoid identity", () =>
    Effect.sync(() => {
      assertMonoidLaws({
        arbitrary: complexArbitrary,
        combine: add,
        equals: complexEquals,
        identity: zero,
        seed: 20_260_405
      })
    }))

  it.effect("keeps multiplicative kernels associative with one as the monoid identity", () =>
    Effect.sync(() => {
      assertMonoidLaws({
        arbitrary: complexArbitrary,
        combine: multiply,
        equals: complexEquals,
        identity: one,
        seed: 20_260_406
      })
    }))
})
