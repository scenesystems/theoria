import { describe, expect, it } from "@effect/vitest"

import { PageLocation } from "../../app/contracts/presentation/page-location.js"
import { PackageDocsRoute, PageRoute } from "../../app/contracts/presentation/path.js"

describe("package docs route authority", () => {
  it("treats /packages as a landing alias and only publishes canonical package-doc routes as visible pages", () => {
    expect(PageRoute.isHtmlLocation(PageLocation.fromPathnameSearch("/packages"), "preview")).toBe(false)
    expect(PackageDocsRoute.redirectPathForReleaseStage("preview")).toBe("/packages?package=effect-math")
    expect(PageRoute.visiblePathsForReleaseStage("preview").includes("/packages")).toBe(false)
    expect(PageRoute.visiblePathsForReleaseStage("preview").includes("/packages?package=effect-math")).toBe(true)
  })
})
