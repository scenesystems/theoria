import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Equal, Number as Num, Option, Ref, Result, Schema, SchemaGetter } from "effect"

import { annotate, fromAST } from "../../src/Distribution.js"
import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const distributionFor = (space: SearchSpace.SearchSpace, name: string) =>
  Arr.findFirst(space.params, (value) => Equal.equals(value.name, name)).pipe(
    Option.map((parameter) => parameter.distribution)
  )

const decodeSpace = (space: SearchSpace.SearchSpace, value: unknown) =>
  Schema.decodeUnknownResult(Schema.toType(space.schema))(value)

const expectOptionValue = <A>(option: Option.Option<A>, expected: A) => {
  expect(option).toEqual(Option.some(expected))
}

const expectReadDistribution = (schema: Schema.Top, expected: unknown) => {
  const distribution = fromAST(schema.ast)
  expect(distribution).toEqual(Option.some(expected))
}

describe("SearchSpace.make", () => {
  it.effect("extracts parameter metadata in stable insertion order", () =>
    Effect.gen(function*() {
      const space = yield* SearchSpace.make({
        lr: SearchSpace.float(1e-4, 1e-1, { scale: "log" }),
        optimizer: SearchSpace.categorical(Arr.make("adam", "sgd", "adamw")),
        batchSize: SearchSpace.int(16, 128, { step: 16 }),
        useBatchNorm: SearchSpace.boolean()
      })

      expect(Arr.map(space.params, (parameter) => parameter.name)).toEqual(Arr.make(
        "lr",
        "optimizer",
        "batchSize",
        "useBatchNorm"
      ))

      expect(Arr.map(space.params, (parameter) => parameter.distribution.type)).toEqual(Arr.make(
        "float",
        "categorical",
        "int",
        "categorical"
      ))
    }))

  it.effect("retains per-parameter distribution metadata that can be discovered from AST annotations", () =>
    Effect.gen(function*() {
      const space = yield* SearchSpace.make({
        lr: SearchSpace.float(0.01, 1, { scale: "log" }),
        batchSize: SearchSpace.int(8, 128, { step: 8 }),
        optimizer: SearchSpace.categorical(Arr.make("adam", "sgd", "adamw")),
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
        choices: Arr.make("adam", "sgd", "adamw")
      })

      expectOptionValue(distributionFor(space, "useBatchNorm"), {
        type: "categorical",
        choices: Arr.make(true, false)
      })
    }))

  it.effect("preserves distribution annotations on each dimension schema", () =>
    Effect.sync(() => {
      const dimensions = {
        lr: SearchSpace.float(0.01, 1, { scale: "log" }),
        optimizer: SearchSpace.categorical(Arr.make("adam", "sgd", "adamw")),
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
        choices: Arr.make("adam", "sgd", "adamw")
      })
      expectReadDistribution(dimensions.batchSize, {
        type: "int",
        low: 16,
        high: 64,
        step: 16
      })
      expectReadDistribution(dimensions.useBatchNorm, {
        type: "categorical",
        choices: Arr.make(true, false)
      })
    }))

  it.effect("builds a schema that enforces the declared configuration contract", () =>
    Effect.gen(function*() {
      const space = yield* SearchSpace.make({
        lr: SearchSpace.float(0.001, 0.1),
        optimizer: SearchSpace.categorical(Arr.make("adam", "sgd", "adamw")),
        batchSize: SearchSpace.int(16, 64, { step: 16 })
      })

      expect(
        Result.isSuccess(
          decodeSpace(space, {
            lr: 0.01,
            optimizer: "adam",
            batchSize: 32
          })
        )
      ).toBe(true)

      expect(
        Result.isFailure(
          decodeSpace(space, {
            lr: 0.01,
            batchSize: 32
          })
        )
      ).toBe(true)

      expect(
        Result.isFailure(
          decodeSpace(space, {
            lr: 0.01,
            optimizer: "rmsprop",
            batchSize: 32
          })
        )
      ).toBe(true)
    }))

  it.effect("decodes dimension transformations before optimization evaluates a config", () =>
    Effect.gen(function*() {
      const transformed = annotate(
        SearchSpace.float(1, 1).pipe(
          Schema.decodeTo(SearchSpace.float(1, 1), {
            decode: SchemaGetter.transform((value) => Num.sum(value, 10)),
            encode: SchemaGetter.transform((value) => Num.subtract(value, 10))
          })
        ),
        { type: "float", low: 1, high: 1 }
      )
      const space = yield* SearchSpace.make({ value: transformed })
      const observed = yield* Ref.make(0)
      yield* Optimization.run(
        new Optimization.FlatOptions({
          space,
          sampler: Sampler.random({ seed: 1 }),
          direction: "minimize",
          trials: 1,
          objective: (config) => Ref.set(observed, config.value).pipe(Effect.as(config.value))
        })
      )

      expect(yield* Ref.get(observed)).toBe(11)
    }))
})
