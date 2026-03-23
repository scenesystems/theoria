import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import { AlgebraDomainContract } from "../../src/Algebra/contract.js"
import { AlgebraDomainModel } from "../../src/Algebra/model.js"
import { AlgebraDomainSchema } from "../../src/Algebra/schema.js"
import { CalculusDomainContract } from "../../src/Calculus/contract.js"
import { CalculusDomainModel } from "../../src/Calculus/model.js"
import { CalculusDomainSchema } from "../../src/Calculus/schema.js"
import { GeometryDomainContract } from "../../src/Geometry/contract.js"
import { GeometryDomainModel } from "../../src/Geometry/model.js"
import { GeometryDomainSchema } from "../../src/Geometry/schema.js"
import { LinearAlgebraDomainContract } from "../../src/LinearAlgebra/contract.js"
import { LinearAlgebraDomainModel } from "../../src/LinearAlgebra/model.js"
import { LinearAlgebraDomainSchema } from "../../src/LinearAlgebra/schema.js"
import { NumericDomainContract } from "../../src/Numeric/contract.js"
import { NumericDomainModel } from "../../src/Numeric/model.js"
import { NumericDomainSchema } from "../../src/Numeric/schema.js"
import { OptimizationDomainContract } from "../../src/Optimization/contract.js"
import { OptimizationDomainModel } from "../../src/Optimization/model.js"
import { OptimizationDomainSchema } from "../../src/Optimization/schema.js"
import { ProbabilityDomainContract } from "../../src/Probability/contract.js"
import { ProbabilityDomainModel } from "../../src/Probability/model.js"
import { ProbabilityDomainSchema } from "../../src/Probability/schema.js"
import { SpecialDomainContract } from "../../src/Special/contract.js"
import { SpecialDomainModel } from "../../src/Special/model.js"
import { SpecialDomainSchema } from "../../src/Special/schema.js"
import { StatisticsDomainContract } from "../../src/Statistics/contract.js"
import { StatisticsDomainModel } from "../../src/Statistics/model.js"
import { StatisticsDomainSchema } from "../../src/Statistics/schema.js"

describe("effect-math model-contract parity", () => {
  it.effect("keeps model.domain aligned with contract authority", () =>
    Effect.gen(function*() {
      expect(NumericDomainModel.domain).toBe(NumericDomainContract)
      expect(AlgebraDomainModel.domain).toBe(AlgebraDomainContract)
      expect(LinearAlgebraDomainModel.domain).toBe(LinearAlgebraDomainContract)
      expect(CalculusDomainModel.domain).toBe(CalculusDomainContract)
      expect(SpecialDomainModel.domain).toBe(SpecialDomainContract)
      expect(ProbabilityDomainModel.domain).toBe(ProbabilityDomainContract)
      expect(StatisticsDomainModel.domain).toBe(StatisticsDomainContract)
      expect(OptimizationDomainModel.domain).toBe(OptimizationDomainContract)
      expect(GeometryDomainModel.domain).toBe(GeometryDomainContract)
    }))

  it.effect("keeps all domain models valid under domain schema authority", () =>
    Effect.gen(function*() {
      expect(Schema.decodeUnknownEither(NumericDomainSchema)(NumericDomainModel)).toMatchObject({
        _tag: "Right",
        right: NumericDomainModel
      })
      expect(Schema.decodeUnknownEither(AlgebraDomainSchema)(AlgebraDomainModel)).toMatchObject({
        _tag: "Right",
        right: AlgebraDomainModel
      })
      expect(Schema.decodeUnknownEither(LinearAlgebraDomainSchema)(LinearAlgebraDomainModel)).toMatchObject({
        _tag: "Right",
        right: LinearAlgebraDomainModel
      })
      expect(Schema.decodeUnknownEither(CalculusDomainSchema)(CalculusDomainModel)).toMatchObject({
        _tag: "Right",
        right: CalculusDomainModel
      })
      expect(Schema.decodeUnknownEither(SpecialDomainSchema)(SpecialDomainModel)).toMatchObject({
        _tag: "Right",
        right: SpecialDomainModel
      })
      expect(Schema.decodeUnknownEither(ProbabilityDomainSchema)(ProbabilityDomainModel)).toMatchObject({
        _tag: "Right",
        right: ProbabilityDomainModel
      })
      expect(Schema.decodeUnknownEither(StatisticsDomainSchema)(StatisticsDomainModel)).toMatchObject({
        _tag: "Right",
        right: StatisticsDomainModel
      })
      expect(Schema.decodeUnknownEither(OptimizationDomainSchema)(OptimizationDomainModel)).toMatchObject({
        _tag: "Right",
        right: OptimizationDomainModel
      })
      expect(Schema.decodeUnknownEither(GeometryDomainSchema)(GeometryDomainModel)).toMatchObject({
        _tag: "Right",
        right: GeometryDomainModel
      })
    }))
})
