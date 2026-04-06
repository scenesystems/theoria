import { describe, expect, it } from "@effect/vitest"
import { Effect, Record, Schema } from "effect"

import {
  resolveWorkflowComparisonAuthorityCatalog,
  workflowComparisonAuthorityCatalogFingerprint,
  workflowComparisonBindingsWithinPublishedConsumerScope,
  workflowComparisonCatalogFingerprint,
  WorkflowComparisonCatalogSchema,
  workflowComparisonConsumerDescriptorFingerprint,
  workflowComparisonConsumerPublication,
  workflowComparisonFingerprint,
  workflowComparisonId,
  workflowComparisonPublicationFingerprint,
  WorkflowProfileLibrarySchema
} from "../../app/contracts/workflow/comparison.js"
import {
  defaultWorkflowComparisonId,
  workflowComparisonById,
  workflowComparisons
} from "../fixtures/workflow/comparisons.js"
import { workflowProfileLibrary } from "../fixtures/workflow/profile-library.js"

describe("Theoria Workflow Comparison Contracts", () => {
  it.effect("decodes the released task, chat, retrieval, and render-sensitive workflow profile library", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(WorkflowProfileLibrarySchema)(workflowProfileLibrary)

      expect(Record.keys(decoded)).toEqual([
        "taskOriented",
        "chatOriented",
        "retrievalOriented",
        "renderSensitive"
      ])
    }))

  it.effect("decodes task-first and chat-continuation baseline-versus-optimized workflow comparisons", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(WorkflowComparisonCatalogSchema)(workflowComparisons)

      expect(decoded.map(workflowComparisonId)).toEqual([
        "workflow-comparison/task-briefing",
        "workflow-comparison/chat-handoff"
      ])
      expect(decoded.map((comparison) => comparison.publication.consumerId)).toEqual([
        workflowComparisonConsumerPublication.consumerId,
        workflowComparisonConsumerPublication.consumerId
      ])
      expect(decoded.map((comparison) => comparison.workflowKind)).toEqual(["task-first", "chat-continuation"])
      expect(decoded.every((comparison) => comparison.authorities.runtime === "effect-inference")).toBe(true)
      expect(decoded.every((comparison) => comparison.authorities.search === "effect-search")).toBe(true)
      expect(decoded.every((comparison) => comparison.authorities.program === "effect-dsp")).toBe(true)
      expect(
        decoded.every((comparison) => workflowComparisonBindingsWithinPublishedConsumerScope(comparison.authorities))
      ).toBe(true)
      expect(
        decoded.every(
          (comparison) =>
            resolveWorkflowComparisonAuthorityCatalog(comparison).runtime.packageName === "effect-inference"
        )
      ).toBe(true)
      expect(
        decoded.every(
          (comparison) => resolveWorkflowComparisonAuthorityCatalog(comparison).search.packageName === "effect-search"
        )
      ).toBe(true)
      expect(
        decoded.every(
          (comparison) => resolveWorkflowComparisonAuthorityCatalog(comparison).program.packageName === "effect-dsp"
        )
      ).toBe(true)
      expect(
        decoded.every((comparison) =>
          comparison.reports.optimized.aggregateScore > comparison.reports.baseline.aggregateScore
        )
      ).toBe(true)
      expect(decoded.every((comparison) => comparison.records.baseline.graph.variant === "baseline")).toBe(true)
      expect(decoded.every((comparison) => comparison.records.optimized.graph.variant === "optimized")).toBe(true)
    }))

  it.effect("derives stable digest provenance for the published workflow-comparison catalog", () =>
    Effect.gen(function*() {
      const catalogFingerprint = yield* workflowComparisonCatalogFingerprint(workflowComparisons)
      const repeatedCatalogFingerprint = yield* workflowComparisonCatalogFingerprint(workflowComparisons)
      const consumerDescriptorFingerprint = yield* workflowComparisonConsumerDescriptorFingerprint()
      const repeatedConsumerDescriptorFingerprint = yield* workflowComparisonConsumerDescriptorFingerprint()
      const publicationFingerprints = yield* Effect.forEach(
        workflowComparisons,
        (comparison) => workflowComparisonPublicationFingerprint(comparison.publication)
      )
      const authorityFingerprints = yield* Effect.forEach(
        workflowComparisons,
        workflowComparisonAuthorityCatalogFingerprint
      )
      const comparisonFingerprints = yield* Effect.forEach(
        workflowComparisons,
        workflowComparisonFingerprint
      )
      const uniqueFingerprints = comparisonFingerprints.filter(
        (fingerprint, index, all) => all.indexOf(fingerprint) === index
      )

      expect(catalogFingerprint).toBe(repeatedCatalogFingerprint)
      expect(consumerDescriptorFingerprint).toBe(repeatedConsumerDescriptorFingerprint)
      expect(uniqueFingerprints.length).toBe(comparisonFingerprints.length)
      expect(publicationFingerprints.length).toBe(workflowComparisons.length)
      expect(authorityFingerprints.every((fingerprint) => fingerprint === authorityFingerprints[0])).toBe(true)
    }))

  it.effect("resolves the default workflow comparison through the catalog selector", () =>
    Effect.sync(() => {
      const comparison = workflowComparisonById(defaultWorkflowComparisonId)

      expect(workflowComparisonId(comparison)).toBe("workflow-comparison/task-briefing")
      expect(comparison.records.optimized.graph.nodes.length).toBeGreaterThan(
        comparison.records.baseline.graph.nodes.length
      )
    }))
})
