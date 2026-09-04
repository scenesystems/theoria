import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Option } from "effect"

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
  it("resolves aliases to their canonical API asset", () => {
    const docsPackage = Option.getOrThrow(Option.fromNullable(docsManifestFixture.packages[0]))

    const module = docsApiModuleFor(docsPackage, docsApiRoute("effect-search", Option.some("study")))
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

  it("projects source documentation modules as navigable API pages", () => {
    const docsPackage = Option.getOrThrow(Option.fromNullable(docsManifestFixture.packages[0]))
    const rootModule = Option.getOrThrow(Arr.findFirst(docsPackage.apiModules, (module) => module.slug.length === 0))
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
    const apiBranch = Option.getOrThrow(Option.fromNullable(branches[1]))

    expect(Arr.map(apiBranch.children, (destination) => destination.label)).toEqual(["algorithms/ed25519"])
    expect(Arr.map(apiBranch.children, (destination) => destination.href)).toEqual([
      "/docs/sign/api/algorithms/ed25519"
    ])
  })

  it("ranks exact symbol matches ahead of package summaries", () => {
    const results = search("runStudy", Option.some("effect-search"))
    expect(results[0]?.id).toBe("effect-search/Study#runStudy")
  })

  it("finds relevant documentation through spacing and typing errors", () => {
    const symbolResults = search("run stduy", Option.some("effect-search"))
    const packageResults = search("effect native optimiztion", Option.none())

    expect(symbolResults[0]?.id).toBe("effect-search/Study#runStudy")
    expect(packageResults[0]?.id).toBe("effect-search")
  })

  it("resolves a selected export from the URL fragment", () => {
    expect(Option.getOrThrow(apiExportForHash(docsApiModuleIndexFixture, "#api-runStudy")).name).toBe("runStudy")
    expect(Option.isNone(apiExportForHash(docsApiModuleIndexFixture, "#category-studies"))).toBe(true)
  })
})
