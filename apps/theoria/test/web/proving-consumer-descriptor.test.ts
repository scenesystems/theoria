import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import { entryIds, runnableEntryIds } from "../../app/contracts/id.js"
import {
  authorityCatalogForId,
  authorityCatalogRegistryFingerprint,
  authorityCatalogs,
  entryDescriptorForId,
  entryDescriptors,
  entryRegistryFingerprint,
  primaryAuthorityIdForEntry
} from "../../app/contracts/proving-substrate.js"
import { lookup } from "../../app/server/entries/registry.js"
import {
  dedicatedEntryIds,
  entryRuntimeDescriptorFingerprint,
  entryRuntimeDescriptorFor,
  entryRuntimeDescriptors,
  entryRuntimeRegistryFingerprint,
  resolveEntryRuntimeProvenance,
  streamingEntryIds
} from "../../app/web/runtime/kernel/registry.js"

describe("web/entry-runtime-registry", () => {
  it.effect("composes the entry runtime registry from authority, substrate, and lane descriptors across all entries", () =>
    Effect.gen(function*() {
      const serverStreamingIds: ReadonlyArray<(typeof entryIds)[number]> = runnableEntryIds.filter((id) =>
        Option.match(lookup(id), {
          onNone: () => false,
          onSome: (definition) => definition.streamPlan !== null || definition.id === "workflow"
        })
      )
      const derivedStreamingIds = entryIds.filter(
        (id) => entryRuntimeDescriptorFor(id).runtime.transport === "sse"
      )
      const passiveIds = entryIds.filter((id) => entryRuntimeDescriptorFor(id).runtime.transport === "fetch")
      const descriptorFingerprints = yield* Effect.forEach(entryIds, (id) =>
        Effect.gen(function*() {
          const descriptor = entryRuntimeDescriptorFor(id)
          const provenance = yield* resolveEntryRuntimeProvenance(descriptor)

          expect(descriptor.entryId).toBe(id)
          expect(descriptor.entry).toEqual(entryDescriptorForId(id))
          expect(descriptor.authority.catalog).toEqual(authorityCatalogForId(primaryAuthorityIdForEntry(id)))
          expect(provenance.descriptorFingerprint).toBe(yield* entryRuntimeDescriptorFingerprint(descriptor))

          return provenance.descriptorFingerprint
        }))
      const uniqueFingerprints = descriptorFingerprints.filter(
        (fingerprint, index, all) => all.indexOf(fingerprint) === index
      )
      const authorityFingerprint = yield* authorityCatalogRegistryFingerprint(authorityCatalogs)
      const repeatedAuthorityFingerprint = yield* authorityCatalogRegistryFingerprint(authorityCatalogs)
      const substrateFingerprint = yield* entryRegistryFingerprint(entryDescriptors)
      const repeatedSubstrateFingerprint = yield* entryRegistryFingerprint(entryDescriptors)
      const registryFingerprint = yield* entryRuntimeRegistryFingerprint(entryRuntimeDescriptors)
      const repeatedRegistryFingerprint = yield* entryRuntimeRegistryFingerprint(
        entryRuntimeDescriptors
      )

      expect(streamingEntryIds).toEqual(derivedStreamingIds)
      expect(streamingEntryIds).toEqual(serverStreamingIds)
      expect([...dedicatedEntryIds].sort()).toEqual([...entryIds].sort())
      expect(entryRuntimeDescriptors.map((descriptor) => descriptor.entryId)).toEqual(entryIds)
      expect(uniqueFingerprints.length).toBe(descriptorFingerprints.length)
      expect(authorityFingerprint).toBe(repeatedAuthorityFingerprint)
      expect(substrateFingerprint).toBe(repeatedSubstrateFingerprint)
      expect(registryFingerprint).toBe(repeatedRegistryFingerprint)

      derivedStreamingIds.forEach((id) => {
        const descriptor = entryRuntimeDescriptorFor(id)

        expect(descriptor.runtime.transport).toBe("sse")
        expect(descriptor.surface.interactiveWidget).not.toBeNull()
        expect(
          id === "workflow"
            ? Option.isNone(descriptor.runtime.projectionDriver)
            : Option.isSome(descriptor.runtime.projectionDriver)
        ).toBe(true)
      })

      passiveIds.forEach((id) => {
        const descriptor = entryRuntimeDescriptorFor(id)

        expect(Option.isNone(descriptor.runtime.projectionDriver)).toBe(true)
        expect(descriptor.surface.interactiveWidget).toBeNull()
        expect(descriptor.adapter.provenance.projectionDriverKey).toBeNull()
      })
    }))
})
