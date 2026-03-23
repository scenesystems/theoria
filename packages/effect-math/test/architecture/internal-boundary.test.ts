import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import * as AlgebraInternal from "../../src/Algebra/internal/index.js"
import * as CalculusInternal from "../../src/Calculus/internal/index.js"
import * as GeometryInternal from "../../src/Geometry/internal/index.js"
import * as RootDomain from "../../src/index.js"
import * as LinearAlgebraInternal from "../../src/LinearAlgebra/internal/index.js"
import * as NumericInternal from "../../src/Numeric/internal/index.js"
import * as OptimizationInternal from "../../src/Optimization/internal/index.js"
import * as ProbabilityInternal from "../../src/Probability/internal/index.js"
import * as SpecialInternal from "../../src/Special/internal/index.js"
import * as StatisticsInternal from "../../src/Statistics/internal/index.js"

const ownKeys = (namespace: Readonly<Record<string, unknown>>): ReadonlyArray<string> =>
  Reflect.ownKeys(namespace)
    .filter((key): key is string => typeof key === "string" && key !== "__esModule")
    .sort()

describe("effect-math internal boundary", () => {
  it.effect("keeps internal namespace markers present only in explicit internal modules", () =>
    Effect.gen(function*() {
      expect(ownKeys(NumericInternal)).toEqual(["NumericInternalNamespace"])
      expect(ownKeys(AlgebraInternal)).toEqual(["AlgebraInternalNamespace"])
      expect(ownKeys(LinearAlgebraInternal)).toEqual(["LinearAlgebraInternalNamespace"])
      expect(ownKeys(CalculusInternal)).toEqual(["CalculusInternalNamespace"])
      expect(ownKeys(SpecialInternal)).toEqual(["SpecialInternalNamespace"])
      expect(ownKeys(ProbabilityInternal)).toEqual(["ProbabilityInternalNamespace"])
      expect(ownKeys(StatisticsInternal)).toEqual(["StatisticsInternalNamespace"])
      expect(ownKeys(OptimizationInternal)).toEqual(["OptimizationInternalNamespace"])
      expect(ownKeys(GeometryInternal)).toEqual(["GeometryInternalNamespace"])
    }))

  it.effect("keeps domain internal namespace markers out of the root barrel", () =>
    Effect.gen(function*() {
      expect(ownKeys(RootDomain).every((key) => !key.endsWith("InternalNamespace"))).toBe(true)
    }))
})
