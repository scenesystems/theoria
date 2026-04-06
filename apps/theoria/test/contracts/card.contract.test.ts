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
  consumerPublicationForId,
  primaryAuthorityCatalogForConsumer,
  publishedConsumerDescriptorForId
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
    expect(scenesystemsCards.map((card) => card.id)).toEqual(["digest", "seal", "sign"])
  })

  it("projects each card through the publication-to-authority substrate seam", () => {
    cards.forEach((card) => {
      const publication = consumerPublicationForId(card.id)
      const authority = primaryAuthorityCatalogForConsumer(card.id)

      expect(card.packageName).toBe(authority.packageName)
      expect(card.title).toBe(authority.title)
      expect(card.summary).toBe(authority.summary)
      expect(card.runLabel).toBe(publication.runLabel)
      expect(card.deepDivePath).toBe(publication.deepDivePath)
    })
  })

  it("keeps application consumers out of the package card catalog while still publishing them in the substrate", () => {
    expect(cards.map((card) => `${card.id}`).includes("workflow-comparison")).toBe(false)
    expect(publishedConsumerDescriptorForId("workflow-comparison").kind).toBe("application")
  })
})
