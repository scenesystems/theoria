import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { appConsumerIds, consumerIds, publishedConsumerIds } from "../../app/contracts/id.js"
import {
  authorityIdsForConsumer,
  consumerPublications,
  packageConsumerDescriptors,
  publishedConsumerDescriptorFingerprint,
  publishedConsumerDescriptorForId,
  publishedConsumerDescriptors,
  publishedConsumerRegistryFingerprint,
  workflowComparisonConsumerDescriptor
} from "../../app/contracts/proving-substrate.js"

describe("Theoria Proving Substrate Contracts", () => {
  it("keeps package, application, and published consumer identity scopes distinct", () => {
    expect(appConsumerIds).toEqual(["workflow-comparison"])
    expect(consumerIds.map((id) => `${id}`).includes("workflow-comparison")).toBe(false)
    expect(publishedConsumerIds.map((id) => `${id}`).includes("workflow-comparison")).toBe(true)
    expect(packageConsumerDescriptors.map((descriptor) => descriptor.publication.consumerId)).toEqual(consumerIds)
    expect(publishedConsumerDescriptors.map((descriptor) => descriptor.publication.consumerId)).toEqual(
      publishedConsumerIds
    )
  })

  it.effect("publishes workflow-comparison as a composite application consumer with stable digest provenance", () =>
    Effect.gen(function*() {
      const descriptor = publishedConsumerDescriptorForId("workflow-comparison")
      const firstFingerprint = yield* publishedConsumerDescriptorFingerprint(descriptor)
      const repeatedFingerprint = yield* publishedConsumerDescriptorFingerprint(descriptor)
      const registryFingerprint = yield* publishedConsumerRegistryFingerprint(publishedConsumerDescriptors)
      const repeatedRegistryFingerprint = yield* publishedConsumerRegistryFingerprint(publishedConsumerDescriptors)

      expect(descriptor).toEqual(workflowComparisonConsumerDescriptor)
      expect(descriptor.kind).toBe("application")
      expect(descriptor.publication.group).toBe("application")
      expect(authorityIdsForConsumer("workflow-comparison")).toEqual([
        "effect-inference",
        "effect-search",
        "effect-dsp",
        "effect-text",
        "effect-math"
      ])
      expect(consumerPublications.some((publication) => publication.consumerId === "workflow-comparison")).toBe(true)
      expect(firstFingerprint).toBe(repeatedFingerprint)
      expect(registryFingerprint).toBe(repeatedRegistryFingerprint)
    }))
})
