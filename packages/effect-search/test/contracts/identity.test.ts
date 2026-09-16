import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Option, Schema } from "effect"

import * as Acquisition from "../../src/Acquisition.js"
import * as Direction from "../../src/Direction.js"
import * as Distribution from "../../src/Distribution.js"
import * as Objective from "../../src/Objective.js"

describe("domain schemas", () => {
  it.effect("defaults absent directions to minimization", () =>
    Effect.sync(() => {
      expect(Direction.orDefault(Option.none())).toBe(Direction.minimize)
      expect(Direction.orDefault(Option.some(Direction.maximize))).toBe(Direction.maximize)
    }))

  it.effect("validates the closed acquisition vocabulary", () =>
    Effect.sync(() => {
      expect(Acquisition.isName("ei")).toBe(true)
      expect(Acquisition.isName("ucb")).toBe(false)
    }))

  it.effect("round-trips distribution annotations through schema AST", () =>
    Effect.sync(() => {
      const distribution: Distribution.Distribution = {
        type: "float",
        low: -1,
        high: 1,
        scale: "linear"
      }
      const annotated = Distribution.annotate(Schema.Number, distribution)
      const invalid = Schema.Number.annotations({
        "@scenesystems/effect-search/Distribution": { type: "unknown" }
      })

      expect(Distribution.fromAST(annotated.ast)).toEqual(Option.some(distribution))
      expect(Distribution.fromAST(invalid.ast)).toEqual(Option.none())
    }))

  it.effect("resolves objective options and coordinate semantics", () =>
    Effect.gen(function*() {
      const scalar = Objective.fromOptions({})
      const vector = Objective.fromOptions({
        direction: "minimize",
        directions: ["maximize", "minimize"]
      })
      const decoded = yield* Schema.decode(Objective.Value)([1, Number.POSITIVE_INFINITY])

      expect(Objective.dimensions(scalar)).toBe(1)
      expect(Objective.dimensions(vector)).toBe(2)
      expect(Objective.directionAt(vector, 0)).toEqual(Option.some("maximize"))
      expect(Objective.directionAt(vector, 2)).toEqual(Option.none())
      expect(Objective.dimensionCount(decoded)).toBe(2)
      expect(Objective.hasDimensions([])).toBe(false)
      expect(Objective.isFiniteValue(decoded)).toBe(false)
      expect(Objective.toVector(3)).toEqual([3])
    }))

  it.effect("rejects unknown directions", () =>
    Effect.gen(function*() {
      const result = yield* Schema.decodeUnknown(Direction.Direction)("ascending").pipe(Effect.either)
      expect(Either.isLeft(result)).toBe(true)
    }))
})
