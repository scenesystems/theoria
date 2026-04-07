import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import { publishedConsumerIds, runnableDemoIds } from "../../app/contracts/id.js"
import {
  authorityCatalogRegistryFingerprint,
  authorityCatalogs,
  primaryAuthorityCatalogForDescriptor,
  publishedConsumerDescriptorForId,
  publishedConsumerDescriptors,
  publishedConsumerRegistryFingerprint
} from "../../app/contracts/proving-substrate.js"
import { lookup } from "../../app/server/demos/registry.js"
import {
  dedicatedLaneConsumerIds,
  missingDedicatedApplicationConsumerIds,
  provingConsumerDescriptorFingerprint,
  provingConsumerDescriptorFor,
  provingConsumerDescriptors,
  provingConsumerRegistryFingerprint,
  resolveProvingConsumerRuntimeProvenance,
  streamingSurfaceIds
} from "../../app/web/runtime/proving-consumer.js"

describe("web/proving-consumer-descriptor", () => {
  it.effect("composes the proving-consumer registry from authority, publication, and lane descriptors across all published consumers", () =>
    Effect.gen(function*() {
      const serverStreamingIds: ReadonlyArray<(typeof publishedConsumerIds)[number]> = [
        ...runnableDemoIds.filter((id) =>
          Option.match(lookup(id), {
            onNone: () => false,
            onSome: (definition) => definition.streamPlan !== null
          })
        ),
        "workflow-comparison"
      ]
      const derivedStreamingIds = publishedConsumerIds.filter(
        (id) => provingConsumerDescriptorFor(id).runtime.transport === "sse"
      )
      const passiveIds = publishedConsumerIds.filter((id) =>
        provingConsumerDescriptorFor(id).runtime.transport === "fetch"
      )
      const descriptorFingerprints = yield* Effect.forEach(publishedConsumerIds, (id) =>
        Effect.gen(function*() {
          const descriptor = provingConsumerDescriptorFor(id)
          const provenance = yield* resolveProvingConsumerRuntimeProvenance(descriptor)

          expect(descriptor.consumerId).toBe(id)
          expect(descriptor.consumer).toEqual(publishedConsumerDescriptorForId(id))
          expect(descriptor.publication).toEqual(descriptor.consumer.publication)
          expect(descriptor.authority.catalog).toEqual(primaryAuthorityCatalogForDescriptor(descriptor.consumer))
          expect(provenance.descriptorFingerprint).toBe(yield* provingConsumerDescriptorFingerprint(descriptor))

          return provenance.descriptorFingerprint
        }))
      const uniqueFingerprints = descriptorFingerprints.filter(
        (fingerprint, index, all) => all.indexOf(fingerprint) === index
      )
      const authorityFingerprint = yield* authorityCatalogRegistryFingerprint(authorityCatalogs)
      const repeatedAuthorityFingerprint = yield* authorityCatalogRegistryFingerprint(authorityCatalogs)
      const substrateFingerprint = yield* publishedConsumerRegistryFingerprint(publishedConsumerDescriptors)
      const repeatedSubstrateFingerprint = yield* publishedConsumerRegistryFingerprint(publishedConsumerDescriptors)
      const registryFingerprint = yield* provingConsumerRegistryFingerprint(provingConsumerDescriptors)
      const repeatedRegistryFingerprint = yield* provingConsumerRegistryFingerprint(
        provingConsumerDescriptors
      )

      expect(streamingSurfaceIds).toEqual(derivedStreamingIds)
      expect(streamingSurfaceIds).toEqual(serverStreamingIds)
      expect([...dedicatedLaneConsumerIds].sort()).toEqual([...streamingSurfaceIds].sort())
      expect(missingDedicatedApplicationConsumerIds).toEqual([])
      expect(provingConsumerDescriptors.map((descriptor) => descriptor.consumerId)).toEqual(publishedConsumerIds)
      expect(uniqueFingerprints.length).toBe(descriptorFingerprints.length)
      expect(authorityFingerprint).toBe(repeatedAuthorityFingerprint)
      expect(substrateFingerprint).toBe(repeatedSubstrateFingerprint)
      expect(registryFingerprint).toBe(repeatedRegistryFingerprint)

      derivedStreamingIds.forEach((id) => {
        const descriptor = provingConsumerDescriptorFor(id)

        expect(descriptor.runtime.transport).toBe("sse")
        expect(descriptor.surface.interactiveWidget).not.toBeNull()
        expect(
          id === "workflow-comparison"
            ? Option.isNone(descriptor.runtime.projectionDriver)
            : Option.isSome(descriptor.runtime.projectionDriver)
        ).toBe(true)
      })

      passiveIds.forEach((id) => {
        const descriptor = provingConsumerDescriptorFor(id)

        expect(Option.isNone(descriptor.runtime.projectionDriver)).toBe(true)
        expect(descriptor.surface.interactiveWidget).toBeNull()
        expect(descriptor.lane.provenance.projectionDriverKey).toBeNull()
      })
    }))
})
