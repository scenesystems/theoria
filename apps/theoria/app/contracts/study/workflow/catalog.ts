import { Option, Schema } from "effect"

import type { WorkflowFixtureManifest } from "./fixture-manifest.js"
import type { WorkflowSeedId } from "./manifest.js"
import type { OpenAgentTraceRegistryEntry } from "./open-agent-trace/study-material.js"
import { WorkflowReference } from "./revision.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export class WorkflowCatalogEntry extends Schema.Class<WorkflowCatalogEntry>("WorkflowCatalogEntry")({
  reference: WorkflowReference,
  label: NonEmptyString,
  summary: NonEmptyString
}) {
  static fromFixtureManifest(fixture: WorkflowFixtureManifest): WorkflowCatalogEntry {
    return WorkflowCatalogEntry.make({
      reference: WorkflowReference.make({
        seedId: fixture.seedId,
        sourceKind: "fixture"
      }),
      label: fixture.label,
      summary: fixture.summary
    })
  }

  static fromOpenAgentTraceEntry(entry: OpenAgentTraceRegistryEntry): WorkflowCatalogEntry {
    return WorkflowCatalogEntry.make({
      reference: workflowReferenceFromOpenAgentTraceEntry(entry),
      label: entry.title,
      summary: entry.summary
    })
  }

  static importedFallback(seedId: WorkflowSeedId): WorkflowCatalogEntry {
    return WorkflowCatalogEntry.make({
      reference: WorkflowReference.make({
        seedId,
        sourceKind: "open-agent-trace"
      }),
      label: "Imported Workflow",
      summary: "This imported workflow seed is active in the study draft but is not present in the browser catalog."
    })
  }
}

export const workflowReferenceFromOpenAgentTraceEntry = (
  entry: OpenAgentTraceRegistryEntry
): WorkflowReference =>
  WorkflowReference.make({
    seedId: entry.workflowProjection.workflowRecord.session.sessionId,
    sourceKind: "open-agent-trace"
  })

export const workflowCatalogEntriesFromFixtures = (
  fixtures: ReadonlyArray<WorkflowFixtureManifest>
): ReadonlyArray<WorkflowCatalogEntry> => fixtures.map(WorkflowCatalogEntry.fromFixtureManifest)

export const workflowCatalogEntriesFromOpenAgentTraceRegistry = (
  registry: ReadonlyArray<OpenAgentTraceRegistryEntry>
): ReadonlyArray<WorkflowCatalogEntry> => registry.map(WorkflowCatalogEntry.fromOpenAgentTraceEntry)

export const mergeWorkflowCatalogEntries = ({
  catalog,
  importedRegistry
}: {
  readonly catalog: ReadonlyArray<WorkflowCatalogEntry>
  readonly importedRegistry: ReadonlyArray<OpenAgentTraceRegistryEntry>
}): ReadonlyArray<WorkflowCatalogEntry> => {
  const importedEntries = workflowCatalogEntriesFromOpenAgentTraceRegistry(importedRegistry)

  return [
    ...catalog,
    ...importedEntries.filter(
      (importedEntry) =>
        !catalog.some((catalogEntry) => catalogEntry.reference.seedId === importedEntry.reference.seedId)
    )
  ]
}

export const workflowCatalogEntryForSeedId = (
  catalog: ReadonlyArray<WorkflowCatalogEntry>,
  seedId: WorkflowSeedId
): Option.Option<WorkflowCatalogEntry> =>
  Option.fromNullable(catalog.find((entry) => entry.reference.seedId === seedId))
