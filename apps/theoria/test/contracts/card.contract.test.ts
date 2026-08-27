import { describe, expect, it } from "@effect/vitest"
import * as Option from "effect/Option"

import {
  cardByIdForReleaseStage,
  cards,
  cardsForReleaseStage,
  effectCards,
  liveDemoCards,
  scenesystemsCards
} from "../../app/contracts/card.js"

const liveDemoIds = [
  "effect-math",
  "effect-search",
  "effect-dsp",
  "effect-text",
  "digest",
  "sign",
  "seal"
]

describe("Theoria Card Publication Contracts", () => {
  it("uses exact scoped npm names as every package title", () => {
    expect(cards.every((card) => card.title === card.packageName)).toBe(true)
    expect(cards.every((card) => card.packageName.startsWith("@scenesystems/"))).toBe(true)
  })

  it("keeps demo routes preview-only while the home catalog retains every package", () => {
    const productionIds = cardsForReleaseStage("production").map((card) => card.id)
    const previewIds = cardsForReleaseStage("preview").map((card) => card.id)

    expect(Option.isSome(cardByIdForReleaseStage("effect-inference", "preview"))).toBe(true)
    expect(Option.isNone(cardByIdForReleaseStage("effect-inference", "production"))).toBe(true)
    expect(Option.isNone(cardByIdForReleaseStage("effect-search", "production"))).toBe(true)
    expect(productionIds).toEqual([])
    expect(previewIds).toEqual(cards.map((card) => card.id))
    expect(cards.find((card) => card.id === "effect-inference")?.demoState).toBe("in-development")
  })

  it("retains each implemented demo for preview builds", () => {
    expect(liveDemoCards.map((card) => card.id)).toEqual(liveDemoIds)
  })

  it("keeps landing-page card order aligned with the README package map", () => {
    expect(effectCards.map((card) => card.id)).toEqual([
      "effect-math",
      "effect-search",
      "effect-dsp",
      "effect-inference",
      "effect-text"
    ])
    expect(scenesystemsCards.map((card) => card.id)).toEqual(["digest", "sign", "seal"])
  })

  it("publishes scoped numerical and inference npm identities without changing card IDs", () => {
    const math = effectCards.find((card) => card.id === "effect-math")
    const inference = effectCards.find((card) => card.id === "effect-inference")

    expect(math?.packageName).toBe("@scenesystems/effect-math")
    expect(math?.npmUrl).toBe("https://www.npmjs.com/package/@scenesystems/effect-math")
    expect(inference?.packageName).toBe("@scenesystems/effect-inference")
    expect(inference?.npmUrl).toBe("https://www.npmjs.com/package/@scenesystems/effect-inference")
  })
})
