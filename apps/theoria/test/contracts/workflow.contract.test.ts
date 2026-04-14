import { describe, expect, it } from "@effect/vitest"
import { Effect, Record, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import { workflowEntryDescriptor } from "../../app/contracts/entry/descriptors/workflow.js"
import {
  defaultWorkflowCatalogEntry,
  defaultWorkflowStudyPath,
  publishedWorkflowCatalogEntries,
  publishedWorkflowEntrySeeds
} from "../../app/contracts/study/workflow/catalog-policy.js"
import { WorkflowFixtureManifest } from "../../app/contracts/study/workflow/fixture-manifest.js"
import { FrozenWorkflowRun } from "../../app/contracts/study/workflow/frozen.js"
import {
  WorkflowProfileLibrarySchema,
  WorkflowScenario,
  WorkflowScenarioCatalogSchema,
  WorkflowScenarioEntry
} from "../../app/contracts/study/workflow/scenario.js"
import { frozenWorkflowForRequest } from "../../app/server/study/workflow/frozen.js"
import { loadOpenAgentTraceRegistry } from "../../app/server/study/workflow/open-agent-trace/registry.js"
import { workflowProfileLibrary } from "../../app/server/study/workflow/profile-library.js"
import { fixtureScenarioForSeedId, scenarios } from "../../app/server/study/workflow/scenario/catalog.js"

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

  it.effect("decodes task, chat, retrieval, and render-sensitive workflow fixtures", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(WorkflowScenarioCatalogSchema)(scenarios)
      const workflowSeedIds = WorkflowFixtureManifest.catalog().map((fixture) => fixture.seedId)

      expect(WorkflowFixtureManifest.catalog().map((fixture) => fixture.seedId)).toEqual(workflowSeedIds)
      expect(workflowEntryDescriptor.seeds).toEqual(publishedWorkflowEntrySeeds)
      expect(publishedWorkflowCatalogEntries.map((entry) => entry.reference.seedId)).toEqual(workflowSeedIds)
      expect(decoded.map(WorkflowScenario.id)).toEqual(workflowSeedIds)
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
      expect(
        decoded.every((scenario) => {
          const manifest = WorkflowFixtureManifest.optionForSeedId(WorkflowScenario.id(scenario)).pipe(
            Option.getOrThrow
          )

          return scenario.records.baseline.session.sessionId === manifest.seedId
            && scenario.records.optimized.session.sessionId === manifest.seedId
        })
      ).toBe(true)
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
      const frozenWorkflowRun = yield* frozenWorkflowForRequest(WorkflowFixtureManifest.defaults().seedId)
      const frozenWorkflowFingerprint = yield* FrozenWorkflowRun.fingerprint(frozenWorkflowRun)
      const repeatedFrozenWorkflowFingerprint = yield* FrozenWorkflowRun.fingerprint(frozenWorkflowRun)

      expect(catalogFingerprint).toBe(repeatedCatalogFingerprint)
      expect(workflowDescriptorFingerprint).toBe(repeatedWorkflowDescriptorFingerprint)
      expect(frozenWorkflowFingerprint).toBe(repeatedFrozenWorkflowFingerprint)
      expect(uniqueFingerprints.length).toBe(scenarioFingerprints.length)
      expect(entryFingerprints.length).toBe(scenarios.length)
    }))

  it.effect("resolves the default published workflow catalog entry through the workflow selector", () =>
    Effect.gen(function*() {
      const fixtureScenario = fixtureScenarioForSeedId(defaultWorkflowCatalogEntry.reference.seedId)

      expect(Option.isSome(fixtureScenario)).toBe(true)
      if (Option.isNone(fixtureScenario)) {
        return yield* Effect.die("default workflow fixture missing from fixture scenario catalog")
      }

      const scenario = fixtureScenario.value

      expect(WorkflowScenario.id(scenario)).toBe(defaultWorkflowCatalogEntry.reference.seedId)
      expect(workflowEntryDescriptor.path).toBe(defaultWorkflowStudyPath)
      expect(workflowEntryDescriptor.seeds[0]).toEqual(publishedWorkflowEntrySeeds[0])
      expect(scenario.records.optimized.graph.nodes.length).toBeGreaterThan(
        scenario.records.baseline.graph.nodes.length
      )
    }))

  it.effect("resolves imported workflow seeds as open-agent-trace revisions instead of remapping them onto fixtures", () =>
    Effect.gen(function*() {
      const importedWorkflowSeedId = yield* loadOpenAgentTraceRegistry.pipe(
        Effect.flatMap((registry) =>
          Option.fromNullable(registry[0]?.workflowProjection.workflowRecord.session.sessionId).pipe(
            Option.match({
              onNone: () => Effect.die("open-agent-trace registry is empty"),
              onSome: Effect.succeed
            })
          )
        )
      )

      expect(Option.isNone(fixtureScenarioForSeedId(importedWorkflowSeedId))).toBe(true)
      const frozen = yield* frozenWorkflowForRequest(importedWorkflowSeedId)

      expect(frozen.reference.sourceKind).toBe("open-agent-trace")
      expect(frozen.seedId).toBe(importedWorkflowSeedId)
      expect(frozen.baseline.record.recordId).toBe(frozen.optimized.record.recordId)
    }))
})
