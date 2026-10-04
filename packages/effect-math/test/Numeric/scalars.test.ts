import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"

import {
  AbsoluteTolerance,
  ConditioningThreshold,
  IterationBudget,
  RelativeTolerance,
  StepSize
} from "../../src/Numeric.js"

describe("Numeric algorithm settings", () => {
  it.effect("decodes positive tolerances, thresholds, and step sizes", () =>
    Effect.gen(function*() {
      expect(yield* Schema.decodeEffect(AbsoluteTolerance)(1e-9)).toBe(1e-9)
      expect(yield* Schema.decodeEffect(RelativeTolerance)(1e-6)).toBe(1e-6)
      expect(yield* Schema.decodeEffect(ConditioningThreshold)(1e12)).toBe(1e12)
      expect(yield* Schema.decodeEffect(StepSize)(0.25)).toBe(0.25)
    }))

  it.effect("rejects zero and non-finite algorithm settings", () =>
    Effect.gen(function*() {
      expect(Option.isNone(yield* Effect.option(Schema.decodeEffect(AbsoluteTolerance)(0)))).toBe(true)
      expect(Option.isNone(yield* Effect.option(Schema.decodeEffect(RelativeTolerance)(Infinity)))).toBe(true)
      expect(Option.isNone(yield* Effect.option(Schema.decodeEffect(StepSize)(-1)))).toBe(true)
    }))

  it.effect("requires a positive integer iteration budget", () =>
    Effect.gen(function*() {
      expect(yield* Schema.decodeEffect(IterationBudget)(64)).toBe(64)
      expect(Option.isNone(yield* Effect.option(Schema.decodeEffect(IterationBudget)(0)))).toBe(true)
      expect(Option.isNone(yield* Effect.option(Schema.decodeEffect(IterationBudget)(2.5)))).toBe(true)
    }))
})
