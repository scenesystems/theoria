import { describe, expect, it } from "@effect/vitest"
import { Equivalence, Record as EffectRecord, Schema } from "effect"

import * as AlgebraInternal from "../../src/Algebra/internal/index.js"
import * as CalculusInternal from "../../src/Calculus/internal/index.js"
import * as GeometryInternal from "../../src/Geometry/internal/index.js"
import * as LinearAlgebraInternal from "../../src/LinearAlgebra/internal/index.js"
import * as NumericInternal from "../../src/Numeric/internal/index.js"
import * as OptimizationInternal from "../../src/Optimization/internal/index.js"
import * as ProbabilityInternal from "../../src/Probability/internal/index.js"
import * as SpecialInternal from "../../src/Special/internal/index.js"
import * as StatisticsInternal from "../../src/Statistics/internal/index.js"

const NamespaceSchema = Schema.Record({ key: Schema.String, value: Schema.Unknown })
const keyEq = Equivalence.array(Equivalence.string)

const namespaceKeys = (value: unknown): ReadonlyArray<string> =>
  EffectRecord.keys(Schema.decodeUnknownSync(NamespaceSchema)(value)).filter((key) => key !== "__esModule").sort()

describe("package internal namespace contracts", () => {
  it("keeps exactly one internal marker in each explicit internal module", () => {
    expect(keyEq(namespaceKeys(NumericInternal), ["NumericInternalNamespace"])).toStrictEqual(true)
    expect(keyEq(namespaceKeys(AlgebraInternal), ["AlgebraInternalNamespace"])).toStrictEqual(true)
    expect(keyEq(namespaceKeys(LinearAlgebraInternal), ["LinearAlgebraInternalNamespace"])).toStrictEqual(true)
    expect(keyEq(namespaceKeys(CalculusInternal), ["CalculusInternalNamespace"])).toStrictEqual(true)
    expect(keyEq(namespaceKeys(SpecialInternal), ["SpecialInternalNamespace"])).toStrictEqual(true)
    expect(keyEq(namespaceKeys(ProbabilityInternal), ["ProbabilityInternalNamespace"])).toStrictEqual(true)
    expect(keyEq(namespaceKeys(StatisticsInternal), ["StatisticsInternalNamespace"])).toStrictEqual(true)
    expect(keyEq(namespaceKeys(OptimizationInternal), ["OptimizationInternalNamespace"])).toStrictEqual(true)
    expect(keyEq(namespaceKeys(GeometryInternal), ["GeometryInternalNamespace"])).toStrictEqual(true)
  })
})
