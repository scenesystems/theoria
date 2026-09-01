import { describe, expect, it } from "@effect/vitest"
import { Option } from "effect"

import { prepareDocsSearchIndex, searchDocs } from "@theoria/docs-model"
import { docsApiRoute } from "../../app/contracts/docs.js"
import { apiExportForHash, docsApiModuleFor } from "../../app/web/view/docs/docsModel.js"
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
