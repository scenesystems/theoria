import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { entryDescriptorFingerprint } from "../../app/contracts/entry/descriptor.js"
import { authorityIdsForEntry } from "../../app/contracts/entry/focus.js"
import { entryIds } from "../../app/contracts/entry/id.js"
import { entryDescriptorForId, entryDescriptors, entryRegistryFingerprint } from "../../app/contracts/entry/registry.js"

describe("Theoria Entry Registry Contracts", () => {
  it("keeps every published entry addressable through one entry-native descriptor registry", () => {
    expect(entryDescriptors.map((descriptor) => descriptor.entryId)).toEqual(entryIds)
    expect(entryDescriptorForId("workflow").entryId).toBe("workflow")
    expect(authorityIdsForEntry("workflow")).toEqual([
      "effect-inference",
      "effect-search",
      "effect-dsp",
      "effect-text",
      "effect-math"
    ])
  })

  it.effect("derives stable descriptor provenance for the workflow entry and the full entry registry", () =>
    Effect.gen(function*() {
      const descriptor = entryDescriptorForId("workflow")
      const firstFingerprint = yield* entryDescriptorFingerprint(descriptor)
      const repeatedFingerprint = yield* entryDescriptorFingerprint(descriptor)
      const registryFingerprint = yield* entryRegistryFingerprint(entryDescriptors)
      const repeatedRegistryFingerprint = yield* entryRegistryFingerprint(entryDescriptors)

      expect(descriptor.entryId).toBe("workflow")
      expect(descriptor.releaseState).toBe("published")
      expect(firstFingerprint).toBe(repeatedFingerprint)
      expect(registryFingerprint).toBe(repeatedRegistryFingerprint)
    }))
})
