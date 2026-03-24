import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Schema } from "effect"

import { decodeAlgebraDomain } from "../../src/Algebra/schema.js"
import { decodeCalculusDomain } from "../../src/Calculus/schema.js"
import { DomainOwnershipMatrix, InitialDomainOwnershipMatrix } from "../../src/contracts/shared/DomainOwnership.js"
import { RuntimePolicies } from "../../src/contracts/shared/RuntimePolicies.js"
import { decodeGeometryDomain } from "../../src/Geometry/schema.js"
import { decodeLinearAlgebraDomain } from "../../src/LinearAlgebra/schema.js"
import { decodeNumericDomain } from "../../src/Numeric/schema.js"
import { decodeOptimizationDomain } from "../../src/Optimization/schema.js"
import { decodeProbabilityDomain } from "../../src/Probability/schema.js"
import { decodeSpecialDomain } from "../../src/Special/schema.js"
import { decodeStatisticsDomain } from "../../src/Statistics/schema.js"

describe("package internal boundary contracts", () => {
  it.effect("enforces strict excess-property rejection at public domain boundaries", () =>
    Effect.gen(function*() {
      const decodeEdges = [
        Effect.either(
          decodeNumericDomain({
            domain: "Numeric",
            stability: "provisional",
            precision: "strict"
          })
        ),
        Effect.either(
          decodeAlgebraDomain({
            domain: "Algebra",
            stability: "provisional",
            structure: "ring"
          })
        ),
        Effect.either(
          decodeLinearAlgebraDomain({
            domain: "LinearAlgebra",
            stability: "provisional",
            tensorShape: [2, 2]
          })
        ),
        Effect.either(
          decodeCalculusDomain({
            domain: "Calculus",
            stability: "provisional",
            derivativeOrder: 2
          })
        ),
        Effect.either(
          decodeSpecialDomain({
            domain: "Special",
            stability: "provisional",
            family: "Bessel"
          })
        ),
        Effect.either(
          decodeProbabilityDomain({
            domain: "Probability",
            stability: "provisional",
            distribution: "Normal"
          })
        ),
        Effect.either(
          decodeStatisticsDomain({
            domain: "Statistics",
            stability: "provisional",
            estimator: "Mean"
          })
        ),
        Effect.either(
          decodeOptimizationDomain({
            domain: "Optimization",
            stability: "provisional",
            solver: "GradientDescent"
          })
        ),
        Effect.either(
          decodeGeometryDomain({
            domain: "Geometry",
            stability: "stable",
            frame: "world"
          })
        )
      ]

      const strictBoundaryResults = yield* Effect.all(decodeEdges)

      yield* Effect.forEach(
        strictBoundaryResults,
        (boundary) =>
          Effect.sync(() => {
            expect(
              Match.value(boundary).pipe(
                Match.tag("Left", ({ left }) => left._tag === "BoundaryDecodeError"),
                Match.tag("Right", () => false),
                Match.exhaustive
              )
            ).toStrictEqual(true)
          }),
        { discard: true }
      )
    }))

  it.effect("keeps ownership and runtime-policy governance surfaces schema-authoritative", () =>
    Effect.gen(function*() {
      const ownership = yield* Schema.decodeUnknown(DomainOwnershipMatrix)(InitialDomainOwnershipMatrix)

      expect(ownership.Probability.owns).toContain("distribution contracts")
      expect(ownership.Statistics.owns).toContain("estimators")

      const runtimeBoundary = yield* Effect.either(
        Schema.decodeUnknown(RuntimePolicies)(
          {
            rngPolicy: {
              policy: "nondeterministic",
              seed: 42
            },
            precisionPolicy: { policy: "strict" },
            backendPolicy: { policy: "typed-array" },
            diagnosticsPolicy: { policy: "enabled" }
          },
          { onExcessProperty: "error" }
        )
      )

      expect(
        Match.value(runtimeBoundary).pipe(
          Match.tag("Left", () => true),
          Match.tag("Right", () => false),
          Match.exhaustive
        )
      ).toStrictEqual(true)
    }))
})
