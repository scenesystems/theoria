import { describe, expect, it } from "@effect/vitest"

import {
  isHtmlPagePath,
  packageDocsLandingRedirectPathForReleaseStage,
  visiblePagePathsForReleaseStage
} from "../../app/contracts/presentation/path.js"

describe("package docs route authority", () => {
  it("treats /packages as a landing alias and only publishes canonical package-doc routes as visible pages", () => {
    expect(isHtmlPagePath("/packages", "preview")).toBe(false)
    expect(packageDocsLandingRedirectPathForReleaseStage("preview")).toBe("/packages?package=effect-math")
    expect(visiblePagePathsForReleaseStage("preview").includes("/packages")).toBe(false)
    expect(visiblePagePathsForReleaseStage("preview").includes("/packages?package=effect-math")).toBe(true)
  })
})
