import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import {
  noncentralTCdf,
  noncentralTCdfValidated,
  noncentralTCdfWithPolicies,
  noncentralTQuantile,
  noncentralTQuantileValidated,
  noncentralTQuantileWithPolicies
} from "../../src/Distribution/operations.js"
import { DistributionAlgebraParityFixtureSchema, FixtureRegistryLive, loadFixture } from "../helpers/fixtures/index.js"

const CDF_TOL = 1e-9
const QUANTILE_TOL = 1e-7

const strictLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(42),
  precision: "strict",
  backend: "scalar",
  diagnostics: "disabled"
})

const expectClose = (actual: number, expected: number, tolerance: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance)

const loadNoncentralCases = Effect.gen(function*() {
  const raw = yield* loadFixture("distribution.algebra-parity")
  const fixture = yield* Schema.decodeUnknown(DistributionAlgebraParityFixtureSchema)(raw, {
    onExcessProperty: "error"
  })

  return Arr.filter(
    Arr.fromIterable(fixture.payload.cases),
    (value) => value.operation === "noncentralTCdf" || value.operation === "noncentralTQuantile"
  )
})

describe("Distribution noncentral-t fixture parity", () => {
  it.effect("pure noncentral-t kernels match committed SciPy authority fixtures", () =>
    Effect.gen(function*() {
      const cases = yield* loadNoncentralCases

      yield* Effect.forEach(
        cases,
        (value) =>
          Effect.sync(() =>
            Match.value(value).pipe(
              Match.when({ operation: "noncentralTCdf" }, (entry) =>
                expectClose(
                  noncentralTCdf(entry.input.x, entry.input.df, entry.input.noncentrality),
                  entry.expected,
                  CDF_TOL
                )),
              Match.when({ operation: "noncentralTQuantile" }, (entry) =>
                expectClose(
                  noncentralTQuantile(entry.input.p, entry.input.df, entry.input.noncentrality),
                  entry.expected,
                  QUANTILE_TOL
                )),
              Match.exhaustive
            )
          ),
        { discard: true }
      )
    }).pipe(Effect.provide(FixtureRegistryLive)))

  it.effect("validated noncentral-t surfaces keep strict boundary decoding", () =>
    Effect.gen(function*() {
      const cdf = yield* noncentralTCdfValidated({
        x: 1.2,
        df: 5,
        noncentrality: 0.75
      })
      const quantile = yield* noncentralTQuantileValidated({
        p: 0.8,
        df: 10,
        noncentrality: 1.5
      })

      expect(cdf).toBeCloseTo(0.6426249085997777, 10)
      expect(quantile).toBeCloseTo(2.5275221266253096, 8)
    }))

  it.effect("policy-aware noncentral-t surfaces stay on distribution authority", () =>
    Effect.gen(function*() {
      const cdf = yield* noncentralTCdfWithPolicies(0, 10, 1.5).pipe(Effect.provide(strictLayer))
      const quantile = yield* noncentralTQuantileWithPolicies(0.2, 8, -1).pipe(Effect.provide(strictLayer))

      expect(cdf).toBeCloseTo(0.06680720126885809, 10)
      expect(quantile).toBeCloseTo(-2.0005452435170508, 8)
    }))
})
