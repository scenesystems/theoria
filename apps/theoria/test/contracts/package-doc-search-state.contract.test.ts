import { describe, expect, it } from "@effect/vitest"
import { packageNameFromString } from "@theoria/source-proof"

import { PackageDocsPackagePageRoute, packageDocsSearchQuery } from "../../app/contracts/presentation/package-docs.js"

describe("package-doc-search-state", () => {
  it("builds typed search requests against the global docs corpus even from a selected package page", () => {
    const query = packageDocsSearchQuery({
      query: "study snapshot",
      route: PackageDocsPackagePageRoute.fromPackageId(packageNameFromString("effect-search"))
    })

    expect(query).toEqual({
      limit: 8,
      packageId: null,
      query: "study snapshot"
    })
  })
})
