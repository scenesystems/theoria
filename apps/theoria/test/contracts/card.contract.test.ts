import { describe, expect, it } from "@effect/vitest"
import * as Option from "effect/Option"

import {
  cardByIdForReleaseStage,
  cards,
  cardsForReleaseStage,
  effectCards,
  scenesystemsCards
} from "../../app/contracts/card.js"
import {
  authorityCatalogForId,
  entryDescriptorForId,
  primaryAuthorityIdForEntry
} from "../../app/contracts/proving-substrate.js"

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
    expect(scenesystemsCards.map((card) => card.id)).toEqual(["digest", "seal", "sign", "workflow"])
  })

  it("projects each card through the entry descriptor and authority substrate seam", () => {
    cards.forEach((card) => {
      const descriptor = entryDescriptorForId(card.id)
      const authority = authorityCatalogForId(primaryAuthorityIdForEntry(card.id))

      expect(card.packageName).toBe(authority.packageName)
      expect(card.title).toBe(descriptor.title)
      expect(card.summary).toBe(descriptor.summary)
      expect(card.runLabel).toBe(descriptor.runLabel)
      expect(card.deepDivePath).toBe(descriptor.path)
    })
  })

  it("publishes the workflow entry directly in the shared card catalog", () => {
    expect(cards.map((card) => `${card.id}`).includes("workflow")).toBe(true)
    expect(entryDescriptorForId("workflow").releaseState).toBe("published")
  })
})
