import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { entryIds } from "../../app/contracts/entry/id.js"
import { EntryRegistry } from "../../app/contracts/entry/registry.js"

const entryRegistry = EntryRegistry.current()

describe("Theoria Entry Registry Contracts", () => {
  it("keeps every published entry addressable through one entry-native descriptor registry", () => {
    expect(entryRegistry.descriptors.map((descriptor) => descriptor.entryId)).toEqual(entryIds)
    expect(entryRegistry.descriptorForId("workflow").entryId).toBe("workflow")
    expect(entryRegistry.descriptorForId("workflow").authorityIds).toEqual([
      "effect-inference",
      "effect-search",
      "effect-dsp",
      "effect-text",
      "effect-math"
    ])
  })

  it.effect("derives stable descriptor provenance for the workflow entry and the full entry registry", () =>
    Effect.gen(function*() {
      const descriptor = entryRegistry.descriptorForId("workflow")
      const firstFingerprint = yield* descriptor.fingerprint()
      const repeatedFingerprint = yield* descriptor.fingerprint()
      const registryFingerprint = yield* entryRegistry.fingerprint()
      const repeatedRegistryFingerprint = yield* entryRegistry.fingerprint()

      expect(descriptor.entryId).toBe("workflow")
      expect(descriptor.releaseState).toBe("published")
      expect(firstFingerprint).toBe(repeatedFingerprint)
      expect(registryFingerprint).toBe(repeatedRegistryFingerprint)
    }))
})
