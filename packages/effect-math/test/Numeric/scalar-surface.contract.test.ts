import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import * as EffectMath from "effect-math"
import * as Numeric from "effect-math/Numeric"

import { verifyPackageReleaseSinceGovernance } from "../../../source-proof/src/index.js"
import releaseSnapshot from "../package/release-snapshots/0.3.0.json" with { type: "json" }

const packageRootUrl = new URL("../../", import.meta.url)

const expectedScalarExports = [
  "TAU",
  "degreesToRadians",
  "radiansToDegrees",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "atan2",
  "sinh",
  "cosh",
  "tanh",
  "asinh",
  "acosh",
  "atanh",
  "hypot",
  "floor",
  "ceil",
  "round",
  "trunc",
  "imul"
]

describe("Numeric scalar surface", () => {
  it.effect("keeps one released elementary scalar surface with release-governed metadata", () =>
    Effect.gen(function*() {
      yield* Effect.forEach(
        expectedScalarExports,
        (name) =>
          Effect.sync(() => {
            expect(name in Numeric).toStrictEqual(true)
            expect(name in EffectMath.Numeric).toStrictEqual(true)
          }),
        { discard: true }
      )

      const numericEntries = releaseSnapshot.exports.filter((entry) => entry.subpath === "./Numeric")

      yield* Effect.forEach(
        expectedScalarExports,
        (name) =>
          Effect.sync(() => {
            const snapshotEntry = numericEntries.find((entry) => entry.exportName === name)
            expect(snapshotEntry).toBeDefined()
            expect(snapshotEntry?.firstReleasedIn).toStrictEqual("0.3.0")
          }),
        { discard: true }
      )

      const governance = yield* verifyPackageReleaseSinceGovernance({ packageRootUrl })

      expect(governance.findings).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))
})
