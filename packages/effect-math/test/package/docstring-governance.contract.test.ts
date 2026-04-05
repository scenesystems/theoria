import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { verifyPackageReleaseSinceGovernance } from "../../../source-proof/src/index.js"

const packageRootUrl = new URL("../../", import.meta.url)

describe("package docstring governance", () => {
  it.effect("keeps public export @since tags release-accurate across the package surface", () =>
    Effect.gen(function*() {
      const result = yield* verifyPackageReleaseSinceGovernance({ packageRootUrl })

      expect(result.packageName).toBe("effect-math")
      expect(result.releaseVersion).toBe("0.3.0")
      expect(result.currentSnapshot.packageName).toBe(result.packageName)
      expect(result.currentSnapshot.releasedVersion).toBe(result.releaseVersion)
      expect(result.findings).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))
})
