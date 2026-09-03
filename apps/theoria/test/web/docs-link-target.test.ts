import { describe, expect, it } from "@effect/vitest"
import { Option } from "effect"

import {
  docsLinkModuleAsset,
  docsLinkPath,
  docsLinkSummary,
  docsLinkTarget,
  docsLinkTitle
} from "../../app/web/view/primitives/docsLinkTarget.js"
import { docsApiModuleIndexFixture } from "../helpers/docs-api-fixtures.js"
import { docsManifestFixture } from "../helpers/docs-fixtures.js"

const resolve = (href: string) => Option.getOrThrow(docsLinkTarget(docsManifestFixture, href))

const firstExport = docsApiModuleIndexFixture.exports[0]

describe("docsLinkTarget", () => {
  it("resolves a package overview by its docs path and heads it by the published name", () => {
    const target = resolve("/docs/effect-search")
    expect(target._tag).toBe("Package")
    expect(docsLinkPath(target)).toBe("docs/effect-search")
    expect(docsLinkTitle(target, "effect-search")).toBe("@scenesystems/effect-search")
    expect(docsLinkSummary(target, Option.none())).toEqual(Option.some(docsManifestFixture.packages[0]?.description))
    expect(docsLinkModuleAsset(target)).toEqual(Option.none())
  })

  it("resolves a guide with its own title and summary", () => {
    const target = resolve("/docs/effect-search/getting-started")
    expect(target._tag).toBe("Guide")
    expect(docsLinkTitle(target, "Getting started")).toBe("Getting started")
    expect(docsLinkSummary(target, Option.none())).toEqual(Option.some("Install and run a study."))
  })

  it("resolves a module by path or alias and summarises the module when no export is named", () => {
    const byPath = resolve("/docs/effect-search/api/Study")
    const byAlias = resolve("/docs/effect-search/api/study")
    expect(byPath._tag).toBe("Module")
    expect(docsLinkPath(byAlias)).toBe("docs/effect-search/api/Study")
    expect(docsLinkSummary(byPath, Option.none())).toEqual(Option.some("Build and run optimization studies."))
    expect(docsLinkModuleAsset(byPath)).toEqual(Option.none())
  })

  it("summarises a named export from the module index, and says nothing before it has loaded", () => {
    const anchor = Option.getOrThrow(Option.fromNullable(firstExport)).anchor
    const target = resolve(`/docs/effect-search/api/Study#${anchor}`)
    expect(docsLinkTitle(target, "Study.ask")).toBe("Study.ask")
    expect(docsLinkModuleAsset(target)).toEqual(Option.some(docsManifestFixture.packages[0]?.apiModules[1]?.asset))
    expect(docsLinkSummary(target, Option.none())).toEqual(Option.none())
    expect(docsLinkSummary(target, Option.some(docsApiModuleIndexFixture))).toEqual(
      Option.some(Option.getOrThrow(Option.fromNullable(firstExport)).summary)
    )
    expect(
      docsLinkSummary(resolve("/docs/effect-search/api/Study#api-missing"), Option.some(docsApiModuleIndexFixture))
    )
      .toEqual(Option.none())
  })

  it("leaves pages the manifest does not know as ordinary links", () => {
    expect(docsLinkTarget(docsManifestFixture, "/docs/effect-search/api/Nowhere")).toEqual(Option.none())
    expect(docsLinkTarget(docsManifestFixture, "/docs/effect-nothing")).toEqual(Option.none())
    expect(docsLinkTarget(docsManifestFixture, "/")).toEqual(Option.none())
  })
})
