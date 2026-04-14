import { describe, expect, it } from "@effect/vitest"

import {
  HomeCatalogAvailabilityChecking,
  HomeCatalogPresentation
} from "../../app/contracts/presentation/home-catalog.js"

describe("Home catalog presentation", () => {
  it("keeps the landing catalog focused on package docs and external references, not workflow study routes", () => {
    const model = HomeCatalogPresentation.project({
      availability: HomeCatalogAvailabilityChecking.checking(),
      packageVersions: null,
      releaseStage: "production"
    })

    expect(model.sections.flatMap((section) => section.cards.map((card) => card.id))).not.toContain("workflow")
    expect(model.sections.flatMap((section) => section.cards.map((card) => card.titlePath))).toEqual(
      model.sections.flatMap((section) => section.cards.map(() => null))
    )
  })
})
