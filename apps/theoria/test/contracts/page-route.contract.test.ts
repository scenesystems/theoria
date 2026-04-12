import { describe, expect, it } from "@effect/vitest"
import { packageNameFromString } from "@theoria/source-proof"

import { EntryRegistry } from "../../app/contracts/entry/registry.js"
import { PagePresentation } from "../../app/contracts/presentation/page.js"
import { EntryRoute, HomePageRoute, PackageDocsRoute, PageRouteKey } from "../../app/contracts/presentation/path.js"

describe("Theoria Page Route Contracts", () => {
  it("round-trips home, entry, and package-doc routes through their noun-owned route keys", () => {
    const routes = [
      HomePageRoute.home(),
      EntryRoute.fromEntryId("effect-search"),
      PackageDocsRoute.fromSelectedPackageId(null),
      PackageDocsRoute.fromSelectedPackageId(packageNameFromString("effect-search"))
    ]

    expect(
      routes.map((route) => PageRouteKey.fromSerialized(route.key().serialize()).route())
    ).toEqual(routes)
  })

  it("projects every registered executable path through the single entry page family", () => {
    const entryRegistry = EntryRegistry.current()

    expect(
      entryRegistry.descriptors.map((descriptor) =>
        PagePresentation.project(EntryRoute.fromEntryId(descriptor.entryId))._tag
      )
    ).toEqual(entryRegistry.descriptors.map(() => "EntryPagePresentation"))
  })
})
