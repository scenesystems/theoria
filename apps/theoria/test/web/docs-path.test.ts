import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { docsPathFor } from "../../app/contracts/docs.js"
import { parsePathname } from "../../app/web/services/path.js"

describe("documentation routes", () => {
  it.effect("keeps the package index at the docs root", () =>
    Effect.sync(() => {
      expect(parsePathname("/docs")).toEqual({ _tag: "DocsIndexRoute" })
      expect(parsePathname("/docs/")).toEqual({ _tag: "DocsIndexRoute" })
    }))

  it.effect("parses package, generic guide, and API module routes", () =>
    Effect.sync(() => {
      expect(parsePathname("/docs/effect-search")).toEqual({
        _tag: "DocsOverviewRoute",
        packageSlug: "effect-search"
      })
      expect(parsePathname("/docs/effect-search/getting-started/")).toEqual({
        _tag: "DocsGuideRoute",
        packageSlug: "effect-search",
        guideSlug: "getting-started"
      })
      expect(parsePathname("/docs/effect-search/api")).toEqual({
        _tag: "DocsApiRoute",
        packageSlug: "effect-search",
        moduleSlug: null
      })
      expect(parsePathname("/docs/effect-search/api/Study/")).toEqual({
        _tag: "DocsApiRoute",
        packageSlug: "effect-search",
        moduleSlug: "Study"
      })
    }))

  it.effect("admits syntactic package routes for manifest-backed resolution", () =>
    Effect.sync(() => {
      expect(parsePathname("/docs/unknown-package/api/Module")).toEqual({
        _tag: "DocsApiRoute",
        packageSlug: "unknown-package",
        moduleSlug: "Module"
      })
      expect(parsePathname("/docs/package/api/not%20valid")).toEqual({ _tag: "DocsNotFoundRoute" })
      expect(parsePathname("/docs/package/guide/extra")).toEqual({ _tag: "DocsNotFoundRoute" })
    }))

  it.effect("formats canonical documentation paths", () =>
    Effect.sync(() => {
      expect(docsPathFor({ _tag: "DocsIndexRoute" })).toBe("/docs")
      expect(docsPathFor({ _tag: "DocsOverviewRoute", packageSlug: "effect-search" }))
        .toBe("/docs/effect-search")
      expect(docsPathFor({
        _tag: "DocsGuideRoute",
        packageSlug: "effect-search",
        guideSlug: "getting-started"
      })).toBe("/docs/effect-search/getting-started")
      expect(docsPathFor({ _tag: "DocsApiRoute", packageSlug: "effect-search", moduleSlug: "Study" }))
        .toBe("/docs/effect-search/api/Study")
      expect(docsPathFor({ _tag: "DocsNotFoundRoute" })).toBe("/docs")
    }))
})
