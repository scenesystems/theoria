import { Schema } from "effect"
import type * as Option from "effect/Option"

import { EntrySeed } from "../../entry/descriptor.js"

import { workflowCatalogEntriesFromFixtures, WorkflowCatalogEntry, workflowCatalogEntryForSeedId } from "./catalog.js"
import { WorkflowFixtureManifest } from "./fixture-manifest.js"
import { type WorkflowSeedId, workflowStudyPath } from "./manifest.js"

const PublishedWorkflowCatalogEntries = Schema.NonEmptyArray(WorkflowCatalogEntry)

export const publishedWorkflowCatalogEntries = Schema.decodeUnknownSync(PublishedWorkflowCatalogEntries)(
  workflowCatalogEntriesFromFixtures(WorkflowFixtureManifest.catalog())
)

export const defaultWorkflowCatalogEntry: WorkflowCatalogEntry = publishedWorkflowCatalogEntries[0]

export const defaultWorkflowSeedId: WorkflowSeedId = defaultWorkflowCatalogEntry.reference.seedId

export const defaultWorkflowStudyPath: string = workflowStudyPath(defaultWorkflowSeedId)

export const publishedWorkflowEntrySeeds: ReadonlyArray<EntrySeed> = publishedWorkflowCatalogEntries.map((entry) =>
  EntrySeed.make({
    seedId: entry.reference.seedId,
    label: entry.label,
    summary: entry.summary
  })
)

export const publishedWorkflowCatalogEntryForSeedId = (
  seedId: WorkflowSeedId
): Option.Option<WorkflowCatalogEntry> => workflowCatalogEntryForSeedId(publishedWorkflowCatalogEntries, seedId)
