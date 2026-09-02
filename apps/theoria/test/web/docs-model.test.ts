import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Option } from "effect"

import { prepareDocsSearchIndex, searchDocs } from "@theoria/docs-model"
import { docsApiRoute } from "../../app/contracts/docs.js"
import { apiExportForHash, docsApiModuleFor, docsNavigationBranchesFor } from "../../app/web/view/docs/docsModel.js"
import { docsApiModuleIndexFixture } from "../helpers/docs-api-fixtures.js"
import { docsManifestFixture, docsSearchIndexFixture } from "../helpers/docs-fixtures.js"

const searchIndex = prepareDocsSearchIndex(docsSearchIndexFixture.entries)
const search = (query: string, packageSlug: string | null) =>
  searchDocs(searchIndex, query, {
    limit: 20,
    packageSlug
  })

describe("documentation view model", () => {
  it("resolves aliases to their canonical API asset", () => {
    const docsPackage = Option.getOrThrow(Option.fromNullable(docsManifestFixture.packages[0]))

    const module = docsApiModuleFor(docsPackage, docsApiRoute("effect-search", "study"))
    expect(Option.getOrThrow(module).path).toBe("/docs/effect-search/api/Study")
  })

  it("projects guides and API modules as parent-child navigation branches", () => {
    const docsPackage = Option.getOrThrow(Option.fromNullable(docsManifestFixture.packages[0]))
    const branches = docsNavigationBranchesFor(docsPackage)

    expect(branches).toHaveLength(2)
    expect(branches[0]?.root.label).toBe("Overview")
    expect(Arr.map(branches[0]?.children ?? [], (destination) => destination.label)).toEqual(["Getting started"])
    expect(branches[1]?.root.label).toBe("API reference")
    expect(Arr.map(branches[1]?.children ?? [], (destination) => destination.label)).toEqual(["Study"])
  })

  it("projects root API categories when a package has no public subpath modules", () => {
    const docsPackage = Option.getOrThrow(Option.fromNullable(docsManifestFixture.packages[0]))
    const rootModule = Option.getOrThrow(Arr.findFirst(docsPackage.apiModules, (module) => module.slug.length === 0))
    const branches = docsNavigationBranchesFor({
      ...docsPackage,
      apiModules: [rootModule]
    })
    const apiBranch = Option.getOrThrow(Option.fromNullable(branches[1]))

    expect(Arr.map(apiBranch.children, (destination) => destination.label)).toEqual(["Studies", "Models"])
    expect(Arr.map(apiBranch.children, (destination) => destination.href)).toEqual([
      "/docs/effect-search/api#category-studies",
      "/docs/effect-search/api#category-models"
    ])
  })

  it("ranks exact symbol matches ahead of package summaries", () => {
    const results = search("runStudy", "effect-search")
    expect(results[0]?.id).toBe("effect-search/Study#runStudy")
  })

  it("finds relevant documentation through spacing and typing errors", () => {
    const symbolResults = search("run stduy", "effect-search")
    const packageResults = search("effect native optimiztion", null)

    expect(symbolResults[0]?.id).toBe("effect-search/Study#runStudy")
    expect(packageResults[0]?.id).toBe("effect-search")
  })

  it("resolves a selected export from the URL fragment", () => {
    expect(Option.getOrThrow(apiExportForHash(docsApiModuleIndexFixture, "#api-runStudy")).name).toBe("runStudy")
    expect(Option.isNone(apiExportForHash(docsApiModuleIndexFixture, "#category-studies"))).toBe(true)
  })
})
