import { describe, expect, it } from "@effect/vitest"
import { Effect, HashSet } from "effect"
import { documentationDiagnostics, searchIndexDiagnostics } from "./review-content.js"
import {
  categoryDiagnostic,
  duplicateGroups,
  linkDiagnostics,
  proseDiagnostic,
  unprojectedDuplicateGroups
} from "./review-rules.js"

describe("API review rules", () => {
  it.effect("rejects null and unresolved authored links", () =>
    Effect.sync(() => {
      const routes = HashSet.make("/docs/pkg/api", "/docs/pkg/api#x")
      expect(linkDiagnostics("owner", [{ kind: "link", text: "missing", href: null }], routes)).toHaveLength(1)
      expect(linkDiagnostics("owner", [{ kind: "link", text: "bad", href: "/docs/pkg/nope" }], routes)).toHaveLength(1)
      expect(linkDiagnostics("owner", [{ kind: "link", text: "ok", href: "/docs/pkg/api#x" }], routes)).toHaveLength(0)
    }))

  it.effect("detects exact duplicates by distinct owner", () =>
    Effect.sync(() => {
      expect(duplicateGroups([
        { owner: "pkg#a", summary: "Encodes bytes." },
        { owner: "pkg#b", summary: "Encodes bytes." }
      ])).toEqual([{ owners: ["pkg#a", "pkg#b"], summary: "encodes bytes" }])
    }))

  it.effect("does not treat short vaguely similar summaries as duplicates", () =>
    Effect.sync(() => {
      expect(duplicateGroups([
        { owner: "pkg#a", summary: "Encodes bytes to hex." },
        { owner: "pkg#b", summary: "Encodes bytes to text." }
      ])).toHaveLength(0)
    }))

  it.effect("keeps independent duplicate components separate", () =>
    Effect.sync(() => {
      expect(duplicateGroups([
        { owner: "pkg#a", summary: "Encodes a canonical digest for persistent storage." },
        { owner: "pkg#b", summary: "Encodes a canonical digest for persistent storage." },
        { owner: "pkg#c", summary: "Decodes a signed envelope from untrusted bytes." },
        { owner: "pkg#d", summary: "Decodes a signed envelope from untrusted bytes." }
      ])).toHaveLength(2)
    }))

  it.effect("does not require exceptions for projections of one declaration", () =>
    Effect.sync(() => {
      expect(unprojectedDuplicateGroups([
        { owner: "pkg#a", summary: "Encodes bytes.", sources: ["source.ts#L10"] },
        { owner: "pkg/alias#a", summary: "Encodes bytes.", sources: ["source.ts#L10"] }
      ])).toHaveLength(0)
      expect(unprojectedDuplicateGroups([
        { owner: "pkg#a", summary: "Encodes bytes.", sources: ["source.ts#L10"] },
        { owner: "pkg#b", summary: "Encodes bytes.", sources: ["source.ts#L20"] }
      ])).toHaveLength(1)
    }))

  it.effect("uses narrow prohibited-prose rules", () =>
    Effect.sync(() => {
      expect(proseDiagnostic("pkg#a", "This function performs work.")).toBeDefined()
      expect(proseDiagnostic("pkg#a", "Performs work without allocation.")).toBeUndefined()
      expect(proseDiagnostic("pkg#a", "A world-class API.")).toBeDefined()
      expect(proseDiagnostic("pkg#a", "Numeric domain public surface.")).toBeDefined()
      expect(proseDiagnostic("pkg#a", "Extracted desired-runtime descriptor type.")).toBeDefined()
      expect(proseDiagnostic("pkg#a", "An error indicating that configuration is invalid.")).toBeDefined()
      expect(proseDiagnostic("pkg#a", "Runtime schema for decoding and validating a result.")).toBeDefined()
      expect(proseDiagnostic("pkg#a", "Schema-decoded boundary for evaluation.")).toBeDefined()
      expect(proseDiagnostic("pkg#a", "An Effect containing a decoded value.")).toBeDefined()
      expect(proseDiagnostic("pkg#a", "Decodes the desired runtime requested by a caller.")).toBeUndefined()
    }))

  it.effect("enforces the controlled public category vocabulary", () =>
    Effect.sync(() => {
      expect(categoryDiagnostic("pkg#a", "schemas")).toBeUndefined()
      expect(categoryDiagnostic("pkg#a", "utils")).toBeDefined()
    }))

  it.effect("separates summaries from remarks and qualifies deprecations", () =>
    Effect.sync(() => {
      const docs = (summary: string, deprecated: string | null) => ({
        summary: [{ kind: "text" as const, text: summary }],
        remarks: [],
        examples: [],
        deprecated: deprecated === null ? null : [{ kind: "text" as const, text: deprecated }],
        see: []
      })
      expect(documentationDiagnostics([
        { owner: "pkg#a", docs: docs("Summary.\n\nAdditional behavior.", null) }
      ], HashSet.empty())).toContain("pkg#a: summary contains content that belongs in @remarks")
      expect(documentationDiagnostics([
        { owner: "pkg#a", docs: docs("Summary.", "Deprecated.") }
      ], HashSet.empty())).toContain("pkg#a: deprecation must identify a replacement and version")
      expect(documentationDiagnostics([
        { owner: "pkg#a", docs: docs("Summary.", "Use `replacement` instead since 0.2.0.") }
      ], HashSet.empty())).toHaveLength(0)
    }))

  it.effect("requires search entries to match canonical presentation metadata", () =>
    Effect.sync(() => {
      const expected = {
        id: "pkg#value",
        package: "@scope/pkg",
        packageSlug: "pkg",
        name: "value",
        qualifiedName: "@scope/pkg.value",
        category: "constants",
        summary: "Identifies the value.",
        path: "/docs/pkg/api",
        anchor: "api-value"
      } as const
      expect(searchIndexDiagnostics([expected], [{ ...expected, kind: "symbol" }])).toHaveLength(0)
      expect(searchIndexDiagnostics([expected], [{ ...expected, kind: "symbol", summary: "Stale." }]))
        .toContain("pkg#value: search index mismatch")
    }))
})
