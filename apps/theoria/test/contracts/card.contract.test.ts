import { describe, expect, it } from "@effect/vitest"
import * as Option from "effect/Option"

import { cardByIdForReleaseStage, cardsForReleaseStage } from "../../app/contracts/card.js"

const comingSoonIds: ReadonlyArray<"digest" | "sign" | "seal"> = ["digest", "sign", "seal"]

describe("Theoria Card Publication Contracts", () => {
  it("keeps coming-soon cards available in preview builds", () => {
    expect(comingSoonIds.every((id) => Option.isSome(cardByIdForReleaseStage(id, "preview")))).toBe(true)
  })

  it("hides coming-soon cards from production catalogs", () => {
    const productionIds = cardsForReleaseStage("production").map((card) => card.id)

    expect(comingSoonIds.every((id) => !productionIds.includes(id))).toBe(true)
    expect(comingSoonIds.every((id) => Option.isNone(cardByIdForReleaseStage(id, "production")))).toBe(true)
  })
})
