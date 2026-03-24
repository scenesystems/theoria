import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Option, Schema } from "effect"

import { readDistribution } from "../../src/contracts/Distribution.js"
import * as EffectSearch from "../../src/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"

const distributionFor = (space: SearchSpace.SearchSpace, name: string) =>
  Option.fromNullable(space.params.find((value) => value.name === name)).pipe(
    Option.map((parameter) => parameter.distribution)
  )

const decodeSpace = (space: SearchSpace.SearchSpace, value: unknown) => Schema.decodeUnknownEither(space.schema)(value)

const expectOptionValue = <A>(option: Option.Option<A>, expected: A) => {
  expect(Option.isSome(option)).toBe(true)

  if (Option.isSome(option)) {
    expect(option.value).toEqual(expected)
  }
}

const expectReadDistribution = (schema: Schema.Schema.AnyNoContext, expected: unknown) => {
  const distribution = readDistribution(schema.ast)
  expect(Option.isSome(distribution)).toBe(true)

  if (Option.isSome(distribution)) {
    expect(distribution.value).toEqual(expected)
  }
}

describe("SearchSpace.make", () => {
  it.effect("exports the north-star public API surface from the package barrel", () =>
    Effect.sync(() => {
      expect(EffectSearch.SearchSpace).toBeDefined()
      expect(EffectSearch.Sampler).toBeDefined()
      expect(EffectSearch.Study).toBeDefined()
      expect(EffectSearch.Trial).toBeDefined()

      expect(EffectSearch.SearchSpace.make).toBeTypeOf("function")
      expect(EffectSearch.SearchSpace.unsafeMake).toBeTypeOf("function")
      expect(EffectSearch.SearchSpace.makeConditional).toBeTypeOf("function")
      expect(EffectSearch.SearchSpace.unsafeMakeConditional).toBeTypeOf("function")
      expect(EffectSearch.SearchSpace.float).toBeTypeOf("function")
      expect(EffectSearch.SearchSpace.int).toBeTypeOf("function")
      expect(EffectSearch.SearchSpace.categorical).toBeTypeOf("function")
      expect(EffectSearch.SearchSpace.boolean).toBeTypeOf("function")
    }))

  it.effect("extracts parameter metadata in stable insertion order", () =>
    Effect.sync(() => {
      const space = SearchSpace.unsafeMake({
        lr: SearchSpace.float(1e-4, 1e-1, { scale: "log" }),
        optimizer: SearchSpace.categorical(["adam", "sgd", "adamw"]),
        batchSize: SearchSpace.int(16, 128, { step: 16 }),
        useBatchNorm: SearchSpace.boolean()
      })

      expect(space.params.map((parameter) => parameter.name)).toEqual([
        "lr",
        "optimizer",
        "batchSize",
        "useBatchNorm"
      ])

      expect(space.params.map((parameter) => parameter.distribution.type)).toEqual([
        "float",
        "categorical",
        "int",
        "categorical"
      ])
    }))

  it.effect("retains per-parameter distribution metadata that can be discovered from AST annotations", () =>
    Effect.sync(() => {
      const space = SearchSpace.unsafeMake({
        lr: SearchSpace.float(0.01, 1, { scale: "log" }),
        batchSize: SearchSpace.int(8, 128, { step: 8 }),
        optimizer: SearchSpace.categorical(["adam", "sgd", "adamw"]),
        useBatchNorm: SearchSpace.boolean()
      })

      expectOptionValue(distributionFor(space, "lr"), {
        type: "float",
        low: 0.01,
        high: 1,
        scale: "log"
      })

      expectOptionValue(distributionFor(space, "batchSize"), {
        type: "int",
        low: 8,
        high: 128,
        step: 8
      })

      expectOptionValue(distributionFor(space, "optimizer"), {
        type: "categorical",
        choices: ["adam", "sgd", "adamw"]
      })

      expectOptionValue(distributionFor(space, "useBatchNorm"), {
        type: "categorical",
        choices: [true, false]
      })
    }))

  it.effect("preserves distribution annotations on each dimension schema", () =>
    Effect.sync(() => {
      const dimensions = {
        lr: SearchSpace.float(0.01, 1, { scale: "log" }),
        optimizer: SearchSpace.categorical(["adam", "sgd", "adamw"]),
        batchSize: SearchSpace.int(16, 64, { step: 16 }),
        useBatchNorm: SearchSpace.boolean()
      }

      expectReadDistribution(dimensions.lr, {
        type: "float",
        low: 0.01,
        high: 1,
        scale: "log"
      })
      expectReadDistribution(dimensions.optimizer, {
        type: "categorical",
        choices: ["adam", "sgd", "adamw"]
      })
      expectReadDistribution(dimensions.batchSize, {
        type: "int",
        low: 16,
        high: 64,
        step: 16
      })
      expectReadDistribution(dimensions.useBatchNorm, {
        type: "categorical",
        choices: [true, false]
      })
    }))

  it.effect("builds a schema that enforces the declared configuration contract", () =>
    Effect.sync(() => {
      const space = SearchSpace.unsafeMake({
        lr: SearchSpace.float(0.001, 0.1),
        optimizer: SearchSpace.categorical(["adam", "sgd", "adamw"]),
        batchSize: SearchSpace.int(16, 64, { step: 16 })
      })

      expect(
        Either.isRight(
          decodeSpace(space, {
            lr: 0.01,
            optimizer: "adam",
            batchSize: 32
          })
        )
      ).toBe(true)

      expect(
        Either.isLeft(
          decodeSpace(space, {
            lr: 0.01,
            batchSize: 32
          })
        )
      ).toBe(true)

      expect(
        Either.isLeft(
          decodeSpace(space, {
            lr: 0.01,
            optimizer: "rmsprop",
            batchSize: 32
          })
        )
      ).toBe(true)
    }))
})
