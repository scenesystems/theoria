import { describe, expect, it } from "@effect/vitest"
import { Effect, Record, Schema } from "effect"

import { entryDescriptorFingerprint } from "../../app/contracts/entry/descriptor.js"
import { workflowEntryDescriptor } from "../../app/contracts/entry/descriptors/workflow.js"
import {
  defaultWorkflowScenarioId,
  workflowAuthorityBindings,
  WorkflowProfileLibrarySchema,
  workflowScenarioCatalogFingerprint,
  WorkflowScenarioCatalogSchema,
  workflowScenarioEntryFingerprint,
  workflowScenarioFingerprint,
  workflowScenarioId,
  workflowScenarioIds,
  workflowScenarioOptions
} from "../../app/contracts/study/workflow/scenario.js"
import { workflowProfileLibrary } from "../../app/server/study/workflow/profile-library.js"
import { workflowScenarioById, workflowScenarios } from "../../app/server/study/workflow/scenario/catalog.js"

describe("Theoria Workflow Contracts", () => {
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

  it.effect("decodes task, chat, retrieval, and render-sensitive workflow scenarios", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(WorkflowScenarioCatalogSchema)(workflowScenarios)

      expect(workflowScenarioOptions.map((option) => option.id)).toEqual(workflowScenarioIds)
      expect(decoded.map(workflowScenarioId)).toEqual(workflowScenarioIds)
      expect(decoded.map((scenario) => scenario.entry.entryId)).toEqual([
        "workflow",
        "workflow",
        "workflow",
        "workflow"
      ])
      expect(decoded.map((scenario) => scenario.workflowKind)).toEqual([
        "task-first",
        "chat-continuation",
        "retrieval-required",
        "render-sensitive"
      ])
      expect(decoded.every((scenario) => scenario.authorities.runtime === workflowAuthorityBindings.runtime)).toBe(true)
      expect(decoded.every((scenario) => scenario.authorities.search === workflowAuthorityBindings.search)).toBe(true)
      expect(decoded.every((scenario) => scenario.authorities.program === workflowAuthorityBindings.program)).toBe(true)
      expect(decoded.every((scenario) => scenario.authorities.render === workflowAuthorityBindings.render)).toBe(true)
      expect(decoded.every((scenario) => scenario.authorities.numeric === workflowAuthorityBindings.numeric)).toBe(true)
      expect(decoded.every((scenario) => scenario.authorities.score === workflowAuthorityBindings.score)).toBe(true)
      expect(
        decoded.every((scenario) =>
          scenario.reports.optimized.aggregateScore > scenario.reports.baseline.aggregateScore
        )
      )
        .toBe(true)
      expect(decoded.every((scenario) => scenario.records.baseline.graph.variant === "baseline")).toBe(true)
      expect(decoded.every((scenario) => scenario.records.optimized.graph.variant === "optimized")).toBe(true)
    }))

  it.effect("derives stable digest provenance for the published workflow catalog", () =>
    Effect.gen(function*() {
      const catalogFingerprint = yield* workflowScenarioCatalogFingerprint(workflowScenarios)
      const repeatedCatalogFingerprint = yield* workflowScenarioCatalogFingerprint(workflowScenarios)
      const workflowDescriptorFingerprint = yield* entryDescriptorFingerprint(workflowEntryDescriptor)
      const repeatedWorkflowDescriptorFingerprint = yield* entryDescriptorFingerprint(workflowEntryDescriptor)
      const entryFingerprints = yield* Effect.forEach(
        workflowScenarios,
        (scenario) => workflowScenarioEntryFingerprint(scenario.entry)
      )
      const scenarioFingerprints = yield* Effect.forEach(
        workflowScenarios,
        workflowScenarioFingerprint
      )
      const uniqueFingerprints = scenarioFingerprints.filter(
        (fingerprint, index, all) => all.indexOf(fingerprint) === index
      )

      expect(catalogFingerprint).toBe(repeatedCatalogFingerprint)
      expect(workflowDescriptorFingerprint).toBe(repeatedWorkflowDescriptorFingerprint)
      expect(uniqueFingerprints.length).toBe(scenarioFingerprints.length)
      expect(entryFingerprints.length).toBe(workflowScenarios.length)
    }))

  it.effect("resolves the default workflow scenario through the catalog selector", () =>
    Effect.sync(() => {
      const scenario = workflowScenarioById(defaultWorkflowScenarioId)

      expect(workflowScenarioId(scenario)).toBe(defaultWorkflowScenarioId)
      expect(scenario.records.optimized.graph.nodes.length).toBeGreaterThan(
        scenario.records.baseline.graph.nodes.length
      )
    }))
})
