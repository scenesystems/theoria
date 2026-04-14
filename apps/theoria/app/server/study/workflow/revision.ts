import { digestSchemaValue } from "@scenesystems/digest"
import { Effect, Option } from "effect"
import { WorkflowExecutionRecordSchema } from "effect-inference/Contracts"

import { WorkflowStudyExecutionError } from "../../../contracts/study/workflow/execution.js"
import type { WorkflowSeedId } from "../../../contracts/study/workflow/manifest.js"
import type { OpenAgentTraceRegistryEntry } from "../../../contracts/study/workflow/open-agent-trace/study-material.js"
import {
  decodeWorkflowRevisionDigest,
  WorkflowReference,
  WorkflowRevision
} from "../../../contracts/study/workflow/revision.js"
import type { WorkflowScenario } from "../../../contracts/study/workflow/scenario.js"

import { loadOpenAgentTraceRegistry } from "./open-agent-trace/registry.js"
import { fixtureScenarioForSeedId } from "./scenario/catalog.js"

type WorkflowRevisionResolution = {
  readonly baselineRecord: WorkflowRevision["executionRecord"]
  readonly optimizedRecord: WorkflowRevision["executionRecord"]
  readonly revision: WorkflowRevision
}

const executionError = (message: string) =>
  new WorkflowStudyExecutionError({
    code: "execution-failed",
    message,
    retryable: false
  })

const workflowRevisionDigest = (record: WorkflowRevision["executionRecord"]) =>
  digestSchemaValue(WorkflowExecutionRecordSchema, record).pipe(
    Effect.flatMap(decodeWorkflowRevisionDigest),
    Effect.mapError(() => executionError(`Workflow revision digest projection failed for ${record.recordId}.`))
  )

const revisionFromScenario = (
  scenario: WorkflowScenario
): Effect.Effect<WorkflowRevisionResolution, WorkflowStudyExecutionError> =>
  Effect.gen(function*() {
    const revisionDigest = yield* workflowRevisionDigest(scenario.records.baseline)

    return {
      baselineRecord: scenario.records.baseline,
      optimizedRecord: scenario.records.optimized,
      revision: WorkflowRevision.make({
        reference: WorkflowReference.make({
          seedId: scenario.entry.seedId,
          sourceKind: "fixture"
        }),
        revisionDigest,
        title: scenario.label,
        summary: scenario.summary,
        workflowKind: scenario.workflowKind,
        executionRecord: scenario.records.baseline
      })
    }
  })

const importedEntryForSeedId = (
  seedId: WorkflowSeedId
): Effect.Effect<Option.Option<OpenAgentTraceRegistryEntry>, WorkflowStudyExecutionError> =>
  loadOpenAgentTraceRegistry.pipe(
    Effect.mapError(() => executionError(`Imported workflow registry lookup failed for ${seedId}.`)),
    Effect.map((registry) =>
      Option.fromNullable(
        registry.find((entry) => entry.workflowProjection.workflowRecord.session.sessionId === seedId)
      )
    )
  )

const revisionFromImportedEntry = (
  entry: OpenAgentTraceRegistryEntry,
  seedId: WorkflowSeedId
): Effect.Effect<WorkflowRevisionResolution, WorkflowStudyExecutionError> =>
  Effect.gen(function*() {
    const revisionDigest = yield* workflowRevisionDigest(entry.workflowProjection.workflowRecord)

    return {
      baselineRecord: entry.workflowProjection.workflowRecord,
      optimizedRecord: entry.workflowProjection.workflowRecord,
      revision: WorkflowRevision.make({
        reference: WorkflowReference.make({
          seedId,
          sourceKind: "open-agent-trace"
        }),
        revisionDigest,
        title: entry.title,
        summary: entry.summary,
        workflowKind: entry.workflowProjection.workflowRecord.workflowKind,
        executionRecord: entry.workflowProjection.workflowRecord
      })
    }
  })

export const resolveWorkflowRevision = (
  seedId: WorkflowSeedId
): Effect.Effect<WorkflowRevisionResolution, WorkflowStudyExecutionError> =>
  fixtureScenarioForSeedId(seedId).pipe(
    Option.match({
      onSome: revisionFromScenario,
      onNone: () =>
        importedEntryForSeedId(seedId).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () =>
                Effect.fail(
                  executionError(`Workflow seed ${seedId} does not resolve to a fixture or imported workflow revision.`)
                ),
              onSome: (entry) => revisionFromImportedEntry(entry, seedId)
            })
          )
        )
    })
  )
