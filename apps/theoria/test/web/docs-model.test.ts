import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option } from "effect"

import { type DocsApiModuleSummary, prepareDocsSearchIndex, searchDocs } from "@theoria/docs-model"
import { docsApiRoute } from "../../app/contracts/docs.js"
import { apiExportForHash, docsApiModuleFor, docsNavigationBranchesFor } from "../../app/web/view/docs/docsModel.js"
import { docsApiModuleIndexFixture } from "../helpers/docs-api-fixtures.js"
import { docsManifestFixture, docsSearchIndexFixture } from "../helpers/docs-fixtures.js"

const searchIndex = prepareDocsSearchIndex(docsSearchIndexFixture.entries)
const search = (query: string, packageSlug: Option.Option<string>) =>
  searchDocs(searchIndex, query, {
    limit: 20,
    packageSlug
  })

describe("documentation view model", () => {
  it.effect("resolves aliases to their canonical API asset", () =>
    Effect.gen(function*() {
      const docsPackage = yield* Arr.head(docsManifestFixture.packages)

      const module = yield* docsApiModuleFor(docsPackage, docsApiRoute("effect-search", Option.some("study")))
      expect(module.path).toBe("/docs/effect-search/api/Study")
    }))

  it.effect("projects guides and API modules as parent-child navigation branches", () =>
    Effect.gen(function*() {
      const docsPackage = yield* Arr.head(docsManifestFixture.packages)
      const branches = docsNavigationBranchesFor(docsPackage)

      expect(branches).toHaveLength(2)
      expect(branches[0]?.root.label).toBe("Overview")
      expect(Arr.map(branches[0]?.children ?? [], (destination) => destination.label)).toEqual(["Getting started"])
      expect(branches[1]?.root.label).toBe("API reference")
      expect(Arr.map(branches[1]?.children ?? [], (destination) => destination.label)).toEqual(["Study"])
    }))

  it.effect("projects root API categories when a package has no public subpath modules", () =>
    Effect.gen(function*() {
      const docsPackage = yield* Arr.head(docsManifestFixture.packages)
      const rootModule = yield* Arr.findFirst(docsPackage.apiModules, (module) => module.slug.length === 0)
      const branches = docsNavigationBranchesFor({
        ...docsPackage,
        apiModules: [rootModule]
      })
      const apiBranch = yield* Arr.get(branches, 1)

      expect(Arr.map(apiBranch.children, (destination) => destination.label)).toEqual(["Studies", "Models"])
      expect(Arr.map(apiBranch.children, (destination) => destination.href)).toEqual([
        "/docs/effect-search/api#category-studies",
        "/docs/effect-search/api#category-models"
      ])
    }))

  it.effect("projects source documentation modules as navigable API pages", () =>
    Effect.gen(function*() {
      const docsPackage = yield* Arr.head(docsManifestFixture.packages)
      const rootModule = yield* Arr.findFirst(docsPackage.apiModules, (module) => module.slug.length === 0)
      const sourceModule: DocsApiModuleSummary = {
        ...rootModule,
        kind: "source",
        name: "algorithms/ed25519",
        slug: "algorithms/ed25519",
        source: "src/algorithms/ed25519.ts",
        path: "/docs/sign/api/algorithms/ed25519",
        asset: "/docs-data/0123456789abcdef0123456789abcdef01234567/packages/sign/pages/algorithms/ed25519.json"
      }
      const branches = docsNavigationBranchesFor({
        ...docsPackage,
        apiModules: [rootModule, sourceModule]
      })
      const apiBranch = yield* Arr.get(branches, 1)

      expect(Arr.map(apiBranch.children, (destination) => destination.label)).toEqual(["algorithms/ed25519"])
      expect(Arr.map(apiBranch.children, (destination) => destination.href)).toEqual([
        "/docs/sign/api/algorithms/ed25519"
      ])
    }))

  it.effect("ranks exact symbol matches ahead of package summaries", () =>
    Effect.sync(() => {
      const results = search("runStudy", Option.some("effect-search"))
      expect(Option.map(Arr.head(results), (entry) => entry.id)).toEqual(
        Option.some("effect-search/Study#runStudy")
      )
    }))

  it.effect("finds relevant documentation through camel-case spacing, transposition, and subsequence typos", () =>
    Effect.sync(() => {
      const symbolResults = search("run stduy", Option.some("effect-search"))
      const packageResults = search("effect native optimiztion", Option.none())

      expect(Option.map(Arr.head(symbolResults), (entry) => entry.id)).toEqual(
        Option.some("effect-search/Study#runStudy")
      )
      expect(Option.map(Arr.head(packageResults), (entry) => entry.id)).toEqual(Option.some("effect-search"))
    }))

  it.effect("normalizes compatibility characters, accents, case, and punctuation", () =>
    Effect.gen(function*() {
      const packageEntry = yield* Arr.head(docsSearchIndexFixture.entries)
      const normalizedIndex = prepareDocsSearchIndex(Arr.of({
        ...packageEntry,
        id: "normalized-entry",
        name: "ＲÉSUMÉ",
        qualifiedName: "Guides/ＲÉSUMÉ"
      }))
      const result = yield* Arr.head(searchDocs(normalizedIndex, "  resume!!!  ", {
        limit: 20,
        packageSlug: Option.none()
      }))

      expect(result.id).toBe("normalized-entry")
    }))

  it.effect("keeps equal-score results stable and returns no results for an empty index", () =>
    Effect.gen(function*() {
      const packageEntry = yield* Arr.head(docsSearchIndexFixture.entries)
      const stableIndex = prepareDocsSearchIndex(Arr.make(
        { ...packageEntry, id: "first", path: "/docs/first" },
        { ...packageEntry, id: "second", path: "/docs/second" }
      ))
      const stableResults = searchDocs(stableIndex, "", { limit: 20, packageSlug: Option.none() })
      const emptyResults = searchDocs(prepareDocsSearchIndex(Arr.empty()), "", {
        limit: 20,
        packageSlug: Option.none()
      })

      expect(Arr.map(stableResults, (entry) => entry.id)).toEqual(Arr.make("first", "second"))
      expect(emptyResults).toEqual(Arr.empty())
    }))

  it.effect("resolves a selected export from the URL fragment", () =>
    Effect.gen(function*() {
      const selected = yield* apiExportForHash(docsApiModuleIndexFixture, "#api-runStudy")
      expect(selected.name).toBe("runStudy")
      expect(Option.isNone(apiExportForHash(docsApiModuleIndexFixture, "#category-studies"))).toBe(true)
    }))
})
