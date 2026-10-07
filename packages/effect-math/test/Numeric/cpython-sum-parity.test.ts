import { BunServices } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import { Chunk, Effect, Number, Schema } from "effect"
import * as Numeric from "../../src/Numeric.js"
import { CPythonSumFixture } from "../helpers/fixtures/cpythonSumSchemas.js"
import { loadFixture } from "../helpers/fixtures/registry.js"

const reference = loadFixture("cpython-sum-001").pipe(
  Effect.flatMap(Schema.decodeUnknownEffect(CPythonSumFixture)),
  Effect.provide(BunServices.layer)
)

it.effect("cpython-sum-001: builtin float sum, compensation and IEEE edges match CPython 3.12 bit for bit", () =>
  Effect.gen(function*() {
    const fixture = yield* reference
    yield* Effect.forEach(fixture.payload.cases, (entry) =>
      Effect.gen(function*() {
        const values = yield* Effect.forEach(entry.values, (value) => Effect.fromOption(Number.parse(value)))
        const expected = yield* Effect.fromOption(Number.parse(entry.expected))
        // toBe uses Object.is: signed zero and NaN are compared exactly.
        expect(Numeric.sumNeumaier(values), entry.id).toBe(expected)
        expect(Numeric.sumNeumaier(Chunk.fromIterable(values)), entry.id).toBe(expected)
      }))
  }))
