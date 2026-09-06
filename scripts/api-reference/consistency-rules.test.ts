import { describe, expect, it } from "@effect/vitest"
import { Effect, HashSet, Option } from "effect"

import { type ExpectedSearchEntry, linkDiagnostics, searchIndexDiagnostics } from "./consistency-rules.js"

describe("API reference consistency rules", () => {
  it.effect("rejects null and unresolved authored links", () =>
    Effect.sync(() => {
      const routes = HashSet.make("/docs/pkg/api", "/docs/pkg/api#x")
      expect(linkDiagnostics("owner", [{ kind: "link", text: "missing", href: Option.none() }], routes)).toEqual([
        "owner: authored link has no target"
      ])
      expect(linkDiagnostics("owner", [{ kind: "link", text: "bad", href: Option.some("/docs/pkg/nope") }], routes))
        .toEqual([
          "owner: unresolved link /docs/pkg/nope"
        ])
      expect(linkDiagnostics("owner", [{ kind: "link", text: "ok", href: Option.some("/docs/pkg/api#x") }], routes))
        .toEqual([])
      expect(
        linkDiagnostics("owner", [{ kind: "link", text: "web", href: Option.some("https://example.com") }], routes)
      ).toEqual([])
    }))

  it.effect("requires search entries to match canonical presentation metadata", () =>
    Effect.sync(() => {
      const expected: ExpectedSearchEntry = {
        id: "pkg#value",
        package: "@scope/pkg",
        packageSlug: "pkg",
        name: "value",
        qualifiedName: "@scope/pkg.value",
        category: Option.some("constants"),
        summary: "Identifies the value.",
        path: "/docs/pkg/api",
        anchor: Option.some("api-value")
      }
      expect(searchIndexDiagnostics([expected], [{ ...expected, kind: "symbol" }])).toEqual([])
      expect(searchIndexDiagnostics([expected], [{ ...expected, kind: "symbol", summary: "Stale." }])).toEqual([
        "pkg#value: search index mismatch"
      ])
      expect(searchIndexDiagnostics([], [{ ...expected, kind: "symbol" }])).toEqual([
        "search index symbol count mismatch"
      ])
    }))
})
