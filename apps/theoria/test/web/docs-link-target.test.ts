import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option } from "effect"

import {
  docsLinkModuleAsset,
  docsLinkPath,
  docsLinkSummary,
  docsLinkTarget,
  docsLinkTitle
} from "../../app/web/view/primitives/docsLinkTarget.js"
import { docsApiModuleIndexFixture } from "../helpers/docs-api-fixtures.js"
import { docsManifestFixture } from "../helpers/docs-fixtures.js"

const resolve = (href: string) => docsLinkTarget(docsManifestFixture, href)

describe("docsLinkTarget", () => {
  it.effect("resolves a package overview by its docs path and heads it by the published name", () =>
    Effect.gen(function*() {
      const target = yield* resolve("/docs/effect-search")
      expect(target._tag).toBe("Package")
      expect(docsLinkPath(target)).toBe("docs/effect-search")
      expect(docsLinkTitle(target, "effect-search")).toBe("@scenesystems/effect-search")
      expect(docsLinkSummary(target, Option.none())).toEqual(
        Option.some(docsManifestFixture.packages[0]?.description)
      )
      expect(docsLinkModuleAsset(target)).toEqual(Option.none())
    }))

  it.effect("resolves a guide with its own title and summary", () =>
    Effect.gen(function*() {
      const target = yield* resolve("/docs/effect-search/getting-started")
      expect(target._tag).toBe("Guide")
      expect(docsLinkTitle(target, "Getting started")).toBe("Getting started")
      expect(docsLinkSummary(target, Option.none())).toEqual(Option.some("Install and run a study."))
    }))

  it.effect("resolves a module by path or alias and summarises the module when no export is named", () =>
    Effect.gen(function*() {
      const byPath = yield* resolve("/docs/effect-search/api/Study")
      const byAlias = yield* resolve("/docs/effect-search/api/study")
      expect(byPath._tag).toBe("Module")
      expect(docsLinkPath(byAlias)).toBe("docs/effect-search/api/Study")
      expect(docsLinkSummary(byPath, Option.none())).toEqual(Option.some("Build and run optimization studies."))
      expect(docsLinkModuleAsset(byPath)).toEqual(Option.none())
    }))

  it.effect("summarises a named export from the module index, and says nothing before it has loaded", () =>
    Effect.gen(function*() {
      const firstExport = yield* Arr.head(docsApiModuleIndexFixture.exports)
      const target = yield* resolve(`/docs/effect-search/api/Study#${firstExport.anchor}`)
      expect(docsLinkTitle(target, "Study.ask")).toBe("Study.ask")
      expect(docsLinkModuleAsset(target)).toEqual(Option.some(docsManifestFixture.packages[0]?.apiModules[1]?.asset))
      expect(docsLinkSummary(target, Option.none())).toEqual(Option.none())
      expect(docsLinkSummary(target, Option.some(docsApiModuleIndexFixture))).toEqual(
        Option.some(firstExport.summary)
      )
      const missing = yield* resolve("/docs/effect-search/api/Study#api-missing")
      expect(docsLinkSummary(missing, Option.some(docsApiModuleIndexFixture))).toEqual(Option.none())
    }))

  it.effect("leaves pages the manifest does not know as ordinary links", () =>
    Effect.sync(() => {
      expect(docsLinkTarget(docsManifestFixture, "/docs/effect-search/api/Nowhere")).toEqual(Option.none())
      expect(docsLinkTarget(docsManifestFixture, "/docs/effect-nothing")).toEqual(Option.none())
      expect(docsLinkTarget(docsManifestFixture, "/")).toEqual(Option.none())
    }))
})
