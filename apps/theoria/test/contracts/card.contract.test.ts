import { describe, expect, it } from "@effect/vitest"
import * as Option from "effect/Option"

import { authorityCatalogForId } from "../../app/contracts/capability/catalog.js"
import { Card } from "../../app/contracts/entry/card.js"
import { EntryRegistry } from "../../app/contracts/entry/registry.js"

const entryRegistry = EntryRegistry.current()

describe("Theoria Card Publication Contracts", () => {
  it("publishes capability cards in preview builds alongside the workflow entry", () => {
    expect(Option.isSome(Card.byIdForReleaseStage("workflow", "preview"))).toBe(true)
    expect(Option.isSome(Card.byIdForReleaseStage("digest", "preview"))).toBe(true)
    expect(Option.isSome(Card.byIdForReleaseStage("sign", "preview"))).toBe(true)
    expect(Option.isSome(Card.byIdForReleaseStage("seal", "preview"))).toBe(true)
  })

  it("keeps published capability cards visible in production catalogs", () => {
    const productionIds = Card.forReleaseStage("production").map((card) => card.id)

    expect(productionIds.includes("workflow")).toBe(true)
    expect(productionIds.includes("digest")).toBe(true)
    expect(productionIds.includes("sign")).toBe(true)
    expect(productionIds.includes("seal")).toBe(true)
  })

  it("keeps landing-page card order aligned with the README package map", () => {
    expect(Card.forGroup("effect").map((card) => card.id)).toEqual([
      "workflow",
      "effect-math",
      "effect-search",
      "effect-dsp",
      "effect-text",
      "effect-inference"
    ])
    expect(Card.forGroup("scenesystems").map((card) => card.id)).toEqual(["digest", "seal", "sign"])
  })

  it("projects capability cards through the authority catalog and the workflow card through the entry descriptor", () => {
    Card.all().forEach((card) => {
      if (card.id === "workflow") {
        const descriptor = entryRegistry.descriptorForId("workflow")
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
        return
      }

      const authority = authorityCatalogForId(card.id)

      expect(card.packageName).toBe(authority.packageName)
      expect(card.title).toBe(authority.title)
      expect(card.summary).toBe(authority.summary)
      expect(card.deepDivePath).toBeNull()
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
