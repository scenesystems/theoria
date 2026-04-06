import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import { consumerIds, runnableDemoIds } from "../../app/contracts/id.js"
import {
  authorityCatalogRegistryFingerprint,
  authorityCatalogs,
  packageConsumerDescriptorForId,
  primaryAuthorityCatalogForDescriptor,
  publishedConsumerDescriptors,
  publishedConsumerRegistryFingerprint
} from "../../app/contracts/proving-substrate.js"
import { lookup } from "../../app/server/demos/registry.js"
import {
  provingConsumerDescriptorFingerprint,
  provingConsumerDescriptorFor,
  provingConsumerDescriptors,
  provingConsumerRegistryFingerprint,
  resolveProvingConsumerRuntimeProvenance,
  streamingSurfaceIds
} from "../../app/web/runtime/proving-consumer.js"

describe("web/proving-consumer-descriptor", () => {
  it.effect("composes the proving-consumer registry from authority, publication, and lane descriptors with stable digest provenance", () =>
    Effect.gen(function*() {
      const serverStreamingIds = runnableDemoIds.filter((id) =>
        Option.match(lookup(id), {
          onNone: () => false,
          onSome: (definition) => definition.streamPlan !== null
        })
      )
      const derivedStreamingIds = consumerIds.filter(
        (id) => provingConsumerDescriptorFor(id).runtime.transport === "sse"
      )
      const passiveIds = consumerIds.filter((id) => provingConsumerDescriptorFor(id).runtime.transport === "fetch")
      const descriptorFingerprints = yield* Effect.forEach(consumerIds, (id) =>
        Effect.gen(function*() {
          const descriptor = provingConsumerDescriptorFor(id)
          const provenance = yield* resolveProvingConsumerRuntimeProvenance(descriptor)

          expect(descriptor.consumerId).toBe(id)
          expect(descriptor.consumer).toEqual(packageConsumerDescriptorForId(id))
          expect(descriptor.publication).toEqual(descriptor.consumer.publication)
          expect(descriptor.authority.authorityId).toBe(descriptor.consumer.authorityScope.authorityId)
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
      expect(provingConsumerDescriptors.map((descriptor) => descriptor.consumerId)).toEqual(consumerIds)
      expect(uniqueFingerprints.length).toBe(descriptorFingerprints.length)
      expect(authorityFingerprint).toBe(repeatedAuthorityFingerprint)
      expect(substrateFingerprint).toBe(repeatedSubstrateFingerprint)
      expect(registryFingerprint).toBe(repeatedRegistryFingerprint)

      derivedStreamingIds.forEach((id) => {
        expect(Option.isSome(provingConsumerDescriptorFor(id).runtime.projectionDriver)).toBe(true)
      })

      passiveIds.forEach((id) => {
        const descriptor = provingConsumerDescriptorFor(id)

        expect(descriptor.authority.catalog).toEqual(primaryAuthorityCatalogForDescriptor(descriptor.consumer))
        expect(Option.isNone(descriptor.runtime.projectionDriver)).toBe(true)
        expect(descriptor.surface.interactiveWidget).toBeNull()
        expect(descriptor.lane.provenance.projectionDriverKey).toBeNull()
      })
    }))
})
