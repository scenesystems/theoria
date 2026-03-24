import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit, Schema } from "effect"

import {
  Complex,
  ComplexDomainContract,
  ComplexDomainModel,
  decodeComplexDomain,
  encodeComplexDomain
} from "../../src/Complex/index.js"

describe("Complex / domain contract", () => {
  it.effect("ComplexDomainContract is 'Complex'", () =>
    Effect.gen(function*() {
      expect(ComplexDomainContract).toStrictEqual("Complex")
    }))

  it.effect("ComplexDomainModel has correct shape", () =>
    Effect.gen(function*() {
      expect(ComplexDomainModel.domain).toStrictEqual("Complex")
      expect(ComplexDomainModel.stability).toStrictEqual("provisional")
    }))

  it.effect("decodeComplexDomain accepts valid input", () =>
    Effect.gen(function*() {
      const result = yield* decodeComplexDomain({
        domain: "Complex",
        stability: "provisional"
      })
      expect(result.domain).toStrictEqual("Complex")
    }))

  it.effect("decodeComplexDomain rejects invalid domain", () =>
    Effect.gen(function*() {
      const result = yield* decodeComplexDomain({
        domain: "Wrong",
        stability: "provisional"
      }).pipe(Effect.exit)
      expect(Exit.isFailure(result)).toBe(true)
    }))

  it.effect("encodeComplexDomain round-trips", () =>
    Effect.gen(function*() {
      const encoded = yield* encodeComplexDomain(ComplexDomainModel)
      expect(encoded.domain).toStrictEqual("Complex")
    }))
})

describe("Complex / Schema.TaggedClass", () => {
  it.effect("Complex has _tag = 'Complex'", () =>
    Effect.gen(function*() {
      const z = new Complex({ re: 1, im: 2 })
      expect(z._tag).toStrictEqual("Complex")
    }))

  it.effect("Complex is instanceof Complex", () =>
    Effect.gen(function*() {
      const z = new Complex({ re: 1, im: 2 })
      expect(z instanceof Complex).toBe(true)
    }))

  it.effect("Complex Schema decode round-trips", () =>
    Effect.gen(function*() {
      const z = new Complex({ re: 3, im: 4 })
      const encoded = yield* Schema.encode(Complex)(z)
      const decoded = yield* Schema.decode(Complex)(encoded)
      expect(decoded.re).toStrictEqual(3)
      expect(decoded.im).toStrictEqual(4)
    }))
})
