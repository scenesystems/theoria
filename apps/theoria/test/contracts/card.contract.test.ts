import { describe, expect, it } from "@effect/vitest"
import * as Option from "effect/Option"

import {
  cardByIdForReleaseStage,
  cardsForReleaseStage,
  effectCards,
  scenesystemsCards
} from "../../app/contracts/card.js"

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

  it("keeps landing-page card order aligned with the README package map", () => {
    expect(effectCards.map((card) => card.id)).toEqual([
      "effect-math",
      "effect-search",
      "effect-dsp",
      "effect-text",
      "effect-inference"
    ])
    expect(scenesystemsCards.map((card) => card.id)).toEqual(["digest", "seal", "sign"])
  })
})
