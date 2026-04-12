import { describe, expect, it } from "@effect/vitest"
import * as Option from "effect/Option"

import { authorityCatalogForId } from "../../app/contracts/capability/catalog.js"
import { Card } from "../../app/contracts/entry/card.js"
import { EntryRegistry } from "../../app/contracts/entry/registry.js"

const entryRegistry = EntryRegistry.current()

const comingSoonIds: ReadonlyArray<"digest" | "sign" | "seal"> = ["digest", "sign", "seal"]

describe("Theoria Card Publication Contracts", () => {
  it("keeps coming-soon cards available in preview builds", () => {
    expect(comingSoonIds.every((id) => Option.isSome(Card.byIdForReleaseStage(id, "preview")))).toBe(true)
  })

  it("hides coming-soon cards from production catalogs", () => {
    const productionIds = Card.forReleaseStage("production").map((card) => card.id)

    expect(comingSoonIds.every((id) => !productionIds.includes(id))).toBe(true)
    expect(comingSoonIds.every((id) => Option.isNone(Card.byIdForReleaseStage(id, "production")))).toBe(true)
  })

  it("keeps landing-page card order aligned with the README package map", () => {
    expect(Card.forGroup("effect").map((card) => card.id)).toEqual([
      "effect-math",
      "effect-search",
      "effect-dsp",
      "effect-text",
      "effect-inference"
    ])
    expect(Card.forGroup("scenesystems").map((card) => card.id)).toEqual(["digest", "seal", "sign", "workflow"])
  })

  it("projects each card through the entry descriptor and capability catalog seam", () => {
    Card.all().forEach((card) => {
      const descriptor = entryRegistry.descriptorForId(card.id)
      const authority = authorityCatalogForId(descriptor.primaryAuthorityId)

      expect(card.packageName).toBe(descriptor.packageName)
      expect(card.title).toBe(descriptor.title)
      expect(card.summary).toBe(descriptor.summary)
      expect(card.runLabel).toBe(descriptor.runLabel)
      expect(card.deepDivePath).toBe(descriptor.path)
      expect(card.version).toBe(authority.version)
      expect(card.npmUrl).toBe(authority.npmUrl)
      expect(card.repoUrl).toBe(authority.repoUrl)
      expect(card.license).toBe(authority.license)
    })
  })

  it("publishes the workflow entry directly in the shared card catalog", () => {
    expect(Card.all().map((card) => `${card.id}`).includes("workflow")).toBe(true)
    expect(entryRegistry.descriptorForId("workflow").releaseState).toBe("published")
  })
})
