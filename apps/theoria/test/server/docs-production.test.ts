import { describe, expect, it } from "@effect/vitest"

import { docsPathExists, metadataForDocs } from "../../app/contracts/metadata.js"
import { docsSitemapPaths } from "../../app/server/routes/sitemap.js"
import { docsManifestFixture } from "../helpers/docs-fixtures.js"

describe("documentation production projection", () => {
  it("projects canonical metadata for guides, modules, and aliases", () => {
    expect(metadataForDocs(docsManifestFixture, "/docs")).toMatchObject({
      title: "Packages — Theoria",
      canonicalPath: "/docs"
    })
    expect(metadataForDocs(docsManifestFixture, "/docs/effect-search/getting-started")).toMatchObject({
      title: "Getting started — @scenesystems/effect-search — Theoria",
      canonicalPath: "/docs/effect-search/getting-started"
    })
    expect(metadataForDocs(docsManifestFixture, "/docs/effect-search/api/study/")).toMatchObject({
      title: "Study — @scenesystems/effect-search — Theoria",
      canonicalPath: "/docs/effect-search/api/Study"
    })
    expect(docsPathExists(docsManifestFixture, "/docs/effect-search/api/Study")).toBe(true)
    expect(docsPathExists(docsManifestFixture, "/docs/effect-search/api/study/")).toBe(true)
    expect(docsPathExists(docsManifestFixture, "/docs/effect-search/api/missing")).toBe(false)
  })

  it("includes guides and canonical API pages in the sitemap without aliases", () => {
    const paths = docsSitemapPaths(docsManifestFixture)
    expect(paths).toContain("/docs")
    expect(paths).toContain("/docs/effect-search")
    expect(paths).toContain("/docs/effect-search/getting-started")
    expect(paths).toContain("/docs/effect-search/api/Study")
    expect(paths).not.toContain("/docs/effect-search/api/study")
  })
})
