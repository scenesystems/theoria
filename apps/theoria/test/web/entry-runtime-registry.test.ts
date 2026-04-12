import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import { authorityCatalogForId } from "../../app/contracts/capability/catalog.js"
import {
  capabilityCatalogRegistry,
  capabilityCatalogRegistryFingerprint
} from "../../app/contracts/capability/registry.js"
import { entryIds, runnableEntryIds } from "../../app/contracts/entry/id.js"
import { EntryRegistry } from "../../app/contracts/entry/registry.js"
import { lookup } from "../../app/server/kernel/registry.js"
import { entryRuntimeDescriptorFor } from "../../app/web/runtime/kernel/entry-runtime-descriptor.js"
import {
  entryRuntimeDescriptorFingerprint,
  entryRuntimeRegistryFingerprint,
  resolveEntryRuntimeProvenance
} from "../../app/web/runtime/kernel/entry-runtime-provenance.js"
import { dedicatedEntryIds } from "../../app/web/runtime/kernel/registry.js"
import { entryRuntimeDescriptors } from "../../app/web/runtime/kernel/registry.js"
import { streamingEntryIds } from "../../app/web/runtime/kernel/surface-runtime.js"

const entryRegistry = EntryRegistry.current()

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
          expect(descriptor.entry).toEqual(entryRegistry.descriptorForId(id))
          expect(descriptor.authority.catalog).toEqual(
            authorityCatalogForId(entryRegistry.descriptorForId(id).primaryAuthorityId)
          )
          expect(provenance.descriptorFingerprint).toBe(yield* entryRuntimeDescriptorFingerprint(descriptor))

          return provenance.descriptorFingerprint
        }))
      const uniqueFingerprints = descriptorFingerprints.filter(
        (fingerprint, index, all) => all.indexOf(fingerprint) === index
      )
      const authorityFingerprint = yield* capabilityCatalogRegistryFingerprint(capabilityCatalogRegistry)
      const repeatedAuthorityFingerprint = yield* capabilityCatalogRegistryFingerprint(capabilityCatalogRegistry)
      const substrateFingerprint = yield* entryRegistry.fingerprint()
      const repeatedSubstrateFingerprint = yield* entryRegistry.fingerprint()
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
        expect(descriptor.provenance.projectionDriverKey).toBeNull()
      })
    }))
})
