import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { docsPathFor } from "../../app/contracts/docs.js"
import { parsePathname } from "../../app/web/services/path.js"

describe("documentation routes", () => {
  it.effect("opens the primary package at the docs root", () =>
    Effect.sync(() => {
      expect(parsePathname("/docs")).toEqual({
        _tag: "DocsOverviewRoute",
        packageSlug: "effect-search"
      })
      expect(parsePathname("/docs/")).toEqual({
        _tag: "DocsOverviewRoute",
        packageSlug: "effect-search"
      })
    }))

  it.effect("parses package, guide, and API routes", () =>
    Effect.sync(() => {
      expect(parsePathname("/docs/effect-search")).toEqual({
        _tag: "DocsOverviewRoute",
        packageSlug: "effect-search"
      })
      expect(parsePathname("/docs/effect-search/getting-started/")).toEqual({
        _tag: "DocsGettingStartedRoute",
        packageSlug: "effect-search"
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

  it.effect("does not admit unknown packages into documentation routes", () =>
    Effect.sync(() => {
      expect(parsePathname("/docs/internal-package/api/Secrets")).toEqual({ _tag: "HomeRoute" })
    }))

  it.effect("formats canonical documentation paths", () =>
    Effect.sync(() => {
      expect(docsPathFor({ _tag: "DocsOverviewRoute", packageSlug: "effect-search" }))
        .toBe("/docs/effect-search")
      expect(docsPathFor({ _tag: "DocsGettingStartedRoute", packageSlug: "effect-search" }))
        .toBe("/docs/effect-search/getting-started")
      expect(docsPathFor({ _tag: "DocsApiRoute", packageSlug: "effect-search", moduleSlug: "Study" }))
        .toBe("/docs/effect-search/api/Study")
    }))
})
