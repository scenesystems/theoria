import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import { makeBrowserApiExportPage, makeBrowserApiModuleIndex } from "./browser-model.js"
import { moduleReflection, routes, sourceUrl } from "./typedoc-presentation.fixture.js"
import { makeApiPresentation } from "./typedoc-presentation.js"

describe("TypeDoc presentation adapter", () => {
  it.effect("creates stable page models with semantic signatures and a canonical search index", () =>
    Effect.gen(function*() {
      const presentation = yield* makeApiPresentation({
        packageName: "@scenesystems/example",
        packageVersion: "1.2.3",
        packageSlug: "example",
        packageDescription: "Optimization primitives for Effect",
        moduleReflection,
        moduleSourceUrl: sourceUrl,
        routes,
        links: [
          ["@scenesystems/example", "Study", "/docs/example/api/Study"],
          ["@scenesystems/example", "snapshot", "/docs/example/api/Study#api-snapshot"],
          ["@scenesystems/example", "ExecuteOutcome", "/docs/example/api/Study#api-ExecuteOutcome"],
          ["@scenesystems/example", "Scheduler", "/docs/example/api/Scheduler"],
          ["@scenesystems/example", "Report", "/docs/example/api/Report#api-Report"]
        ]
      })
      const page = Option.getOrThrow(Option.fromNullable(presentation.pages[0]))
      const snapshotExport = page?.exports[0]
      const outcomeExport = page?.exports[1]

      expect(page).toMatchObject({
        schemaVersion: 1,
        path: "/docs/example/api/Study",
        canonical: true,
        canonicalPath: "/docs/example/api/Study",
        aliases: ["/docs/example/api/study"],
        module: {
          name: "Study",
          since: "1.0.0",
          sourceUrl
        },
        categories: [
          { name: "persistence", exportIds: ["example/Study#snapshot"] },
          { name: "models", exportIds: ["example/Study#ExecuteOutcome"] }
        ]
      })
      expect(snapshotExport?.facets[0]?.declaration).not.toContain("export declare")
      expect(snapshotExport?.summary).toBe("Snapshot a completed study result.")
      expect(snapshotExport?.facets[0]?.signatures).toHaveLength(2)
      expect(snapshotExport?.facets[0]?.signatures[0]).toMatchObject({
        code: "snapshot<Config = unknown>(result: StudyResult<Config>): Effect<StudySnapshot>",
        typeParameters: [{ name: "Config", constraint: null, default: "unknown" }],
        parameters: [{ name: "result", type: "StudyResult<Config>", optional: false }],
        returns: { type: "Effect<StudySnapshot>" },
        sourceUrl: `${sourceUrl}#L20`
      })
      expect(snapshotExport?.facets[0]?.signatures[0]?.docs.summary).toEqual([
        { kind: "text", text: "Snapshot a " },
        { kind: "code", text: "completed" },
        { kind: "text", text: " study result." }
      ])
      expect(snapshotExport?.facets[0]?.signatures[0]?.docs.examples[0]).toEqual({
        language: "ts",
        code: "const encoded = snapshot(result)",
        parts: []
      })
      expect(snapshotExport?.facets[0]?.signatures[0]?.docs.see).toEqual([
        [{ kind: "link", text: "snapshot", href: "/docs/example/api/Study#api-snapshot" }],
        [{ kind: "link", text: "Scheduler", href: "/docs/example/api/Scheduler" }],
        [{ kind: "link", text: "import(\"./Report.js\").Report", href: "/docs/example/api/Report#api-Report" }]
      ])
      expect(snapshotExport?.facets[0]?.signatures[1]?.code).toBe(
        "snapshot(handle?: StudyHandle): Effect<StudySnapshot, SnapshotError>"
      )
      expect(outcomeExport?.facets).toHaveLength(2)
      expect(outcomeExport?.facets[0]).toMatchObject({
        kind: "interface",
        declaration: "interface ExecuteOutcome<Config = unknown>",
        typeParameters: [{ name: "Config", constraint: null, default: "unknown" }],
        members: [{
          name: "trials",
          kind: "property",
          declaration: "readonly trials: Trial<Config>[]",
          sourceUrl: `${sourceUrl}#L40`
        }]
      })
      expect(presentation.searchEntries.map(({ id, kind, name, path, anchor }) => [
        id, kind, name, path, anchor
      ])).toEqual([
        ["example/Study", "module", "Study", "/docs/example/api/Study", null],
        ["example/Study#snapshot", "symbol", "snapshot", "/docs/example/api/Study", "api-snapshot"],
        ["example/Study#ExecuteOutcome", "symbol", "ExecuteOutcome", "/docs/example/api/Study", "api-ExecuteOutcome"]
      ])
      expect(presentation.searchEntries[1]).toMatchObject({
        package: "@scenesystems/example",
        qualifiedName: "@scenesystems/example/Study.snapshot",
        category: "persistence",
        summary: "Snapshot a completed study result."
      })

      const browserPage = makeBrowserApiModuleIndex(
        page,
        "0123456789abcdef0123456789abcdef01234567",
        "packages/example/pages/Study.json"
      )
      expect(browserPage.kind).toBe("api-module-index")
      expect(browserPage.exports[0]).toMatchObject({
        name: "snapshot",
        asset: "/docs-data/0123456789abcdef0123456789abcdef01234567/packages/example/pages/Study/api-snapshot.json"
      })
      expect(browserPage.exports[0]).not.toHaveProperty("facets")
      const browserExport = makeBrowserApiExportPage(Option.getOrThrow(Option.fromNullable(snapshotExport)))
      expect(browserExport.kind).toBe("api-export")
      expect(browserExport.export.name).toBe("snapshot")
      expect(browserExport.export.facets[0]?.signatures[0]?.code).toContain("snapshot")
    }))
})
