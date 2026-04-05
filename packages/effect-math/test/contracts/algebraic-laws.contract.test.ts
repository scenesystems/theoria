import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import fc from "fast-check"

import type { Complex } from "../../src/Complex/model.js"
import { add, multiply, of, one, zero } from "../../src/Complex/operations.js"

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
      fc.assert(
        fc.property(complexArbitrary, complexArbitrary, complexArbitrary, (a, b, c) => {
          const left = add(add(a, b), c)
          const right = add(a, add(b, c))
          const leftIdentity = add(zero, a)
          const rightIdentity = add(a, zero)

          return complexEquals(left, right)
            && complexEquals(leftIdentity, a)
            && complexEquals(rightIdentity, a)
        }),
        { seed: 20_260_405 }
      )
    }))

  it.effect("keeps multiplicative kernels associative with one as the monoid identity", () =>
    Effect.sync(() => {
      fc.assert(
        fc.property(complexArbitrary, complexArbitrary, complexArbitrary, (a, b, c) => {
          const left = multiply(multiply(a, b), c)
          const right = multiply(a, multiply(b, c))
          const leftIdentity = multiply(one, a)
          const rightIdentity = multiply(a, one)

          return complexEquals(left, right)
            && complexEquals(leftIdentity, a)
            && complexEquals(rightIdentity, a)
        }),
        { seed: 20_260_406 }
      )
    }))
})
