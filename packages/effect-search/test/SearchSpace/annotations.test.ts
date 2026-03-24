import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import type { Schema } from "effect"

import { readDistribution } from "../../src/contracts/Distribution.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"

const expectDistribution = (schema: Schema.Schema.AnyNoContext, expected: unknown) => {
  const distribution = readDistribution(schema.ast)
  expect(Option.isSome(distribution)).toBe(true)

  if (Option.isSome(distribution)) {
    expect(distribution.value).toEqual(expected)
  }
}

describe("SearchSpace annotations", () => {
  it.effect("annotates float dimensions with bounds and scale", () =>
    Effect.sync(() => {
      const schema = SearchSpace.float(0.01, 1, { scale: "log" })

      expectDistribution(schema, {
        type: "float",
        low: 0.01,
        high: 1,
        scale: "log"
      })
    }))

  it.effect("annotates int dimensions with bounds and step", () =>
    Effect.sync(() => {
      const schema = SearchSpace.int(8, 128, { step: 8 })

      expectDistribution(schema, {
        type: "int",
        low: 8,
        high: 128,
        step: 8
      })
    }))

  it.effect("annotates categorical dimensions with literal choices", () =>
    Effect.sync(() => {
      const schema = SearchSpace.categorical(["adam", "sgd", "adamw"])

      expectDistribution(schema, {
        type: "categorical",
        choices: ["adam", "sgd", "adamw"]
      })
    }))

  it.effect("annotates fidelity dimensions for scheduler resource control", () =>
    Effect.sync(() => {
      const schema = SearchSpace.fidelity(1, 9)

      expectDistribution(schema, {
        type: "fidelity",
        low: 1,
        high: 9
      })
    }))

  it.effect("models booleans as categorical dimensions", () =>
    Effect.sync(() => {
      const schema = SearchSpace.boolean()

      expectDistribution(schema, {
        type: "categorical",
        choices: [true, false]
      })
    }))
})
