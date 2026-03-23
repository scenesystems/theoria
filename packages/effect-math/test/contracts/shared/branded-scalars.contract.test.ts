import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Number, Schema } from "effect"
import * as SchemaAST from "effect/SchemaAST"

import {
  AbsoluteTolerance,
  Axis,
  ConditioningThreshold,
  Dimension,
  IterationBudget,
  RelativeTolerance,
  Seed,
  StepSize
} from "../../../src/contracts/shared/BrandedScalars.js"

describe("shared branded scalar contracts", () => {
  it("declares the canonical brand identifier for each scalar contract", () => {
    expect(SchemaAST.getBrandAnnotation(Dimension.ast)).toMatchObject({ _tag: "Some", value: ["Dimension"] })
    expect(SchemaAST.getBrandAnnotation(Axis.ast)).toMatchObject({ _tag: "Some", value: ["Axis"] })
    expect(SchemaAST.getBrandAnnotation(AbsoluteTolerance.ast)).toMatchObject({
      _tag: "Some",
      value: ["AbsoluteTolerance"]
    })
    expect(SchemaAST.getBrandAnnotation(RelativeTolerance.ast)).toMatchObject({
      _tag: "Some",
      value: ["RelativeTolerance"]
    })
    expect(SchemaAST.getBrandAnnotation(Seed.ast)).toMatchObject({ _tag: "Some", value: ["Seed"] })
    expect(SchemaAST.getBrandAnnotation(IterationBudget.ast)).toMatchObject({
      _tag: "Some",
      value: ["IterationBudget"]
    })
    expect(SchemaAST.getBrandAnnotation(ConditioningThreshold.ast)).toMatchObject({
      _tag: "Some",
      value: ["ConditioningThreshold"]
    })
    expect(SchemaAST.getBrandAnnotation(StepSize.ast)).toMatchObject({
      _tag: "Some",
      value: ["StepSize"]
    })
  })

  it.effect("accepts canonical valid values and rejects out-of-bound values", () =>
    Effect.gen(function*() {
      expect(Number.Equivalence(yield* Schema.decodeUnknown(Dimension)(3), 3)).toStrictEqual(true)
      expect(Number.Equivalence(yield* Schema.decodeUnknown(Axis)(0), 0)).toStrictEqual(true)
      expect(Number.Equivalence(yield* Schema.decodeUnknown(AbsoluteTolerance)(1e-9), 1e-9)).toStrictEqual(true)
      expect(Number.Equivalence(yield* Schema.decodeUnknown(RelativeTolerance)(1e-6), 1e-6)).toStrictEqual(true)
      expect(Number.Equivalence(yield* Schema.decodeUnknown(Seed)(42), 42)).toStrictEqual(true)
      expect(Number.Equivalence(yield* Schema.decodeUnknown(IterationBudget)(1000), 1000)).toStrictEqual(true)
      expect(Number.Equivalence(yield* Schema.decodeUnknown(ConditioningThreshold)(1e-3), 1e-3)).toStrictEqual(true)
      expect(Number.Equivalence(yield* Schema.decodeUnknown(StepSize)(1e-2), 1e-2)).toStrictEqual(true)

      const invalidDimension = yield* Effect.either(Schema.decodeUnknown(Dimension)(0))
      const invalidAxis = yield* Effect.either(Schema.decodeUnknown(Axis)(-1))
      const invalidAbsoluteTolerance = yield* Effect.either(Schema.decodeUnknown(AbsoluteTolerance)(-1e-9))
      const invalidRelativeTolerance = yield* Effect.either(Schema.decodeUnknown(RelativeTolerance)(0))
      const invalidConditioningThreshold = yield* Effect.either(Schema.decodeUnknown(ConditioningThreshold)(0))
      const invalidStepSize = yield* Effect.either(Schema.decodeUnknown(StepSize)(0))

      expect(
        Match.value(invalidDimension).pipe(
          Match.tag("Left", () => true),
          Match.tag("Right", () => false),
          Match.exhaustive
        )
      ).toStrictEqual(true)
      expect(
        Match.value(invalidAxis).pipe(
          Match.tag("Left", () => true),
          Match.tag("Right", () => false),
          Match.exhaustive
        )
      ).toStrictEqual(true)
      expect(
        Match.value(invalidAbsoluteTolerance).pipe(
          Match.tag("Left", () => true),
          Match.tag("Right", () => false),
          Match.exhaustive
        )
      ).toStrictEqual(true)
      expect(
        Match.value(invalidRelativeTolerance).pipe(
          Match.tag("Left", () => true),
          Match.tag("Right", () => false),
          Match.exhaustive
        )
      ).toStrictEqual(true)
      expect(
        Match.value(invalidConditioningThreshold).pipe(
          Match.tag("Left", () => true),
          Match.tag("Right", () => false),
          Match.exhaustive
        )
      ).toStrictEqual(true)
      expect(
        Match.value(invalidStepSize).pipe(
          Match.tag("Left", () => true),
          Match.tag("Right", () => false),
          Match.exhaustive
        )
      ).toStrictEqual(true)
    }))
})
