import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import * as AlgebraDomain from "../../src/Algebra/index.js"
import * as CalculusDomain from "../../src/Calculus/index.js"
import * as GeometryDomain from "../../src/Geometry/index.js"
import * as LinearAlgebraDomain from "../../src/LinearAlgebra/index.js"
import * as NumericDomain from "../../src/Numeric/index.js"
import * as OptimizationDomain from "../../src/Optimization/index.js"
import * as ProbabilityDomain from "../../src/Probability/index.js"
import * as SpecialDomain from "../../src/Special/index.js"
import * as StatisticsDomain from "../../src/Statistics/index.js"

const ownKeys = (namespace: Readonly<Record<string, unknown>>): ReadonlyArray<string> =>
  Reflect.ownKeys(namespace)
    .filter((key): key is string => typeof key === "string" && key !== "__esModule")
    .sort()

describe("effect-math domain structure", () => {
  it.effect("exposes the exact standard domain barrel surface for all nine domains", () =>
    Effect.gen(function*() {
      expect(ownKeys(NumericDomain)).toEqual([
        "NumericDomainBoundaryError",
        "NumericDomainContract",
        "NumericDomainModel",
        "NumericDomainSchema",
        "loadNumericDomain"
      ])
      expect(ownKeys(AlgebraDomain)).toEqual([
        "AlgebraDomainBoundaryError",
        "AlgebraDomainContract",
        "AlgebraDomainModel",
        "AlgebraDomainSchema",
        "loadAlgebraDomain"
      ])
      expect(ownKeys(LinearAlgebraDomain)).toEqual([
        "LinearAlgebraDomainBoundaryError",
        "LinearAlgebraDomainContract",
        "LinearAlgebraDomainModel",
        "LinearAlgebraDomainSchema",
        "loadLinearAlgebraDomain"
      ])
      expect(ownKeys(CalculusDomain)).toEqual([
        "CalculusDomainBoundaryError",
        "CalculusDomainContract",
        "CalculusDomainModel",
        "CalculusDomainSchema",
        "loadCalculusDomain"
      ])
      expect(ownKeys(SpecialDomain)).toEqual([
        "SpecialDomainBoundaryError",
        "SpecialDomainContract",
        "SpecialDomainModel",
        "SpecialDomainSchema",
        "loadSpecialDomain"
      ])
      expect(ownKeys(ProbabilityDomain)).toEqual([
        "ProbabilityDomainBoundaryError",
        "ProbabilityDomainContract",
        "ProbabilityDomainModel",
        "ProbabilityDomainSchema",
        "loadProbabilityDomain"
      ])
      expect(ownKeys(StatisticsDomain)).toEqual([
        "StatisticsDomainBoundaryError",
        "StatisticsDomainContract",
        "StatisticsDomainModel",
        "StatisticsDomainSchema",
        "loadStatisticsDomain"
      ])
      expect(ownKeys(OptimizationDomain)).toEqual([
        "OptimizationDomainBoundaryError",
        "OptimizationDomainContract",
        "OptimizationDomainModel",
        "OptimizationDomainSchema",
        "loadOptimizationDomain"
      ])
      expect(ownKeys(GeometryDomain)).toEqual([
        "GeometryDomainBoundaryError",
        "GeometryDomainContract",
        "GeometryDomainModel",
        "GeometryDomainSchema",
        "loadGeometryDomain"
      ])
    }))

  it.effect("keeps domain internal namespace markers out of domain barrels", () =>
    Effect.gen(function*() {
      expect(ownKeys(NumericDomain).every((key) => !key.endsWith("InternalNamespace"))).toBe(true)
      expect(ownKeys(AlgebraDomain).every((key) => !key.endsWith("InternalNamespace"))).toBe(true)
      expect(ownKeys(LinearAlgebraDomain).every((key) => !key.endsWith("InternalNamespace"))).toBe(true)
      expect(ownKeys(CalculusDomain).every((key) => !key.endsWith("InternalNamespace"))).toBe(true)
      expect(ownKeys(SpecialDomain).every((key) => !key.endsWith("InternalNamespace"))).toBe(true)
      expect(ownKeys(ProbabilityDomain).every((key) => !key.endsWith("InternalNamespace"))).toBe(true)
      expect(ownKeys(StatisticsDomain).every((key) => !key.endsWith("InternalNamespace"))).toBe(true)
      expect(ownKeys(OptimizationDomain).every((key) => !key.endsWith("InternalNamespace"))).toBe(true)
      expect(ownKeys(GeometryDomain).every((key) => !key.endsWith("InternalNamespace"))).toBe(true)
    }))
})
