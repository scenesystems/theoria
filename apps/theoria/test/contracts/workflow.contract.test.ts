import { describe, expect, it } from "@effect/vitest"
import { Effect, Record, Schema } from "effect"
import * as Arr from "effect/Array"

import { workflowEntryDescriptor } from "../../app/contracts/entry/descriptors/workflow.js"
import { FrozenWorkflowRun } from "../../app/contracts/study/workflow/frozen.js"
import { WorkflowScenarioManifest } from "../../app/contracts/study/workflow/manifest.js"
import {
  WorkflowProfileLibrarySchema,
  WorkflowScenario,
  WorkflowScenarioCatalogSchema,
  WorkflowScenarioEntry
} from "../../app/contracts/study/workflow/scenario.js"
import { frozenWorkflowForRequest } from "../../app/server/study/workflow/frozen.js"
import { workflowProfileLibrary } from "../../app/server/study/workflow/profile-library.js"
import { scenarioById, scenarios } from "../../app/server/study/workflow/scenario/catalog.js"

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
      const decoded = yield* Schema.decodeUnknown(WorkflowScenarioCatalogSchema)(scenarios)
      const scenarioIds = WorkflowScenarioManifest.ids()

      expect(WorkflowScenarioManifest.catalog().map((scenario) => scenario.id)).toEqual(scenarioIds)
      expect(workflowEntryDescriptor.seeds.map((seed) => seed.seedId)).toEqual(scenarioIds)
      expect(decoded.map(WorkflowScenario.id)).toEqual(scenarioIds)
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
      const catalogFingerprint = yield* WorkflowScenario.catalogFingerprint(scenarios)
      const repeatedCatalogFingerprint = yield* WorkflowScenario.catalogFingerprint(scenarios)
      const workflowDescriptorFingerprint = yield* workflowEntryDescriptor.fingerprint()
      const repeatedWorkflowDescriptorFingerprint = yield* workflowEntryDescriptor.fingerprint()
      const entryFingerprints = yield* Effect.forEach(
        scenarios,
        (scenario) => WorkflowScenarioEntry.fingerprint(scenario.entry)
      )
      const scenarioFingerprints = yield* Effect.forEach(
        scenarios,
        WorkflowScenario.fingerprint
      )
      const uniqueFingerprints = Arr.dedupe(scenarioFingerprints)
      const frozenWorkflowRun = yield* frozenWorkflowForRequest(WorkflowScenarioManifest.defaults().id)
      const frozenWorkflowFingerprint = yield* FrozenWorkflowRun.fingerprint(frozenWorkflowRun)
      const repeatedFrozenWorkflowFingerprint = yield* FrozenWorkflowRun.fingerprint(frozenWorkflowRun)

      expect(catalogFingerprint).toBe(repeatedCatalogFingerprint)
      expect(workflowDescriptorFingerprint).toBe(repeatedWorkflowDescriptorFingerprint)
      expect(frozenWorkflowFingerprint).toBe(repeatedFrozenWorkflowFingerprint)
      expect(uniqueFingerprints.length).toBe(scenarioFingerprints.length)
      expect(entryFingerprints.length).toBe(scenarios.length)
    }))

  it.effect("resolves the default workflow scenario through the catalog selector", () =>
    Effect.gen(function*() {
      const defaultWorkflowScenarioId = WorkflowScenarioManifest.defaults().id
      const scenario = scenarioById(defaultWorkflowScenarioId)

      expect(WorkflowScenario.id(scenario)).toBe(defaultWorkflowScenarioId)
      expect(WorkflowScenarioManifest.forId(defaultWorkflowScenarioId).searchSeed()).toBe(410)
      expect(scenario.records.optimized.graph.nodes.length).toBeGreaterThan(
        scenario.records.baseline.graph.nodes.length
      )
    }))
})
