import { describe, expect, it } from "@effect/vitest"
import { Option } from "effect"

import { docsApiRoute } from "../../app/contracts/docs.js"
import { apiExportForHash, docsApiModuleFor, docsSearchResults } from "../../app/web/view/docs/docsModel.js"
import { apiPageFixture, docsManifestFixture, docsSearchIndexFixture } from "../helpers/docs-fixtures.js"

describe("documentation view model", () => {
  it("resolves aliases to their canonical API asset", () => {
    const docsPackage = Option.getOrThrow(Option.fromNullable(docsManifestFixture.packages[0]))

    const module = docsApiModuleFor(docsPackage, docsApiRoute("effect-search", "study"))
    expect(Option.getOrThrow(module).path).toBe("/docs/effect-search/api/Study")
  })

  it("ranks exact symbol matches ahead of package summaries", () => {
    const results = docsSearchResults(docsSearchIndexFixture.entries, "runStudy", "effect-search")
    expect(results[0]?.id).toBe("effect-search/Study#runStudy")
  })

  it("resolves a selected export from the URL fragment", () => {
    expect(Option.getOrThrow(apiExportForHash(apiPageFixture, "#api-runStudy")).name).toBe("runStudy")
    expect(Option.isNone(apiExportForHash(apiPageFixture, "#category-studies"))).toBe(true)
  })
})
