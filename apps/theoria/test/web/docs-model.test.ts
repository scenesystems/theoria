import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Struct } from "effect"
import * as Str from "effect/String"

import {
  DocsApiModuleSummarySchema,
  DocsPackageSummarySchema,
  prepareDocsSearchIndex,
  searchDocs
} from "@theoria/docs-model"
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
      const guides = yield* Arr.get(branches, 0)
      const api = yield* Arr.get(branches, 1)

      expect(branches).toHaveLength(2)
      expect(guides.root.label).toBe("Overview")
      expect(Arr.map(guides.children, (destination) => destination.label)).toEqual(Arr.make("Getting started"))
      expect(api.root.label).toBe("API reference")
      expect(Arr.map(api.children, (destination) => destination.label)).toEqual(Arr.make("Study"))
    }))

  it.effect("projects root API categories when a package has no public subpath modules", () =>
    Effect.gen(function*() {
      const docsPackage = yield* Arr.head(docsManifestFixture.packages)
      const rootModule = yield* Arr.findFirst(docsPackage.apiModules, (module) => Str.isEmpty(module.slug))
      const branches = docsNavigationBranchesFor(DocsPackageSummarySchema.make(Struct.evolve(docsPackage, {
        apiModules: () => Arr.make(rootModule)
      })))
      const apiBranch = yield* Arr.get(branches, 1)

      expect(Arr.map(apiBranch.children, (destination) => destination.label)).toEqual(Arr.make("Studies", "Models"))
      expect(Arr.map(apiBranch.children, (destination) => destination.href)).toEqual(Arr.make(
        "/docs/effect-search/api#category-studies",
        "/docs/effect-search/api#category-models"
      ))
    }))

  it.effect("projects the canonical Ed25519 entrypoint as a navigable API page", () =>
    Effect.gen(function*() {
      const docsPackage = yield* Arr.head(docsManifestFixture.packages)
      const rootModule = yield* Arr.findFirst(docsPackage.apiModules, (module) => Str.isEmpty(module.slug))
      const ed25519Module = DocsApiModuleSummarySchema.make(Struct.evolve(rootModule, {
        kind: (): "entrypoint" => "entrypoint",
        name: () => "Ed25519",
        subpath: () => "./Ed25519",
        slug: () => "Ed25519",
        source: () => "src/Ed25519.ts",
        path: () => "/docs/sign/api/Ed25519",
        asset: () => "/docs-data/0123456789abcdef0123456789abcdef01234567/packages/sign/pages/Ed25519.json"
      }))
      const branches = docsNavigationBranchesFor(DocsPackageSummarySchema.make(Struct.evolve(docsPackage, {
        apiModules: () => Arr.make(rootModule, ed25519Module)
      })))
      const apiBranch = yield* Arr.get(branches, 1)

      expect(Arr.map(apiBranch.children, (destination) => destination.label)).toEqual(Arr.make("Ed25519"))
      expect(Arr.map(apiBranch.children, (destination) => destination.href)).toEqual(
        Arr.make("/docs/sign/api/Ed25519")
      )
    }))

  it.effect("ranks exact symbol matches ahead of package summaries", () =>
    Effect.gen(function*() {
      const results = search("runStudy", Option.some("effect-search"))
      const result = yield* Arr.head(results)
      expect(result.id).toBe("effect-search/Study#runStudy")
    }))

  it.effect("finds relevant documentation through spacing and typing errors", () =>
    Effect.gen(function*() {
      const symbolResults = search("run stduy", Option.some("effect-search"))
      const packageResults = search("effect native optimiztion", Option.none())
      const symbolResult = yield* Arr.head(symbolResults)
      const packageResult = yield* Arr.head(packageResults)

      expect(symbolResult.id).toBe("effect-search/Study#runStudy")
      expect(packageResult.id).toBe("effect-search")
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
