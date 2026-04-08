import { Schema } from "effect"

import { defaultWorkflowEntryDraft } from "../../../contracts/entry/defaults.js"
import { EntryRunRequest } from "../../../contracts/entry/registry.js"
import {
  defaultWorkflowComparisonId,
  workflowComparisonOptionForId
} from "../../../contracts/study/workflow/comparison/comparison.js"
import { surfaceDraftAtom, surfaceRunStateAtom } from "../../atoms/surface/state.js"
import { entryStreamPath } from "../../services/EntryClient.js"
import { WorkflowControl } from "../../view/study/workflow/WorkflowControl.js"
import { makeEntryRuntimeAdapterDescriptor } from "../kernel/descriptor.js"
import { makeServerOnlyStreamingSurfaceRuntime, type SurfaceRuntimeSnapshot } from "../kernel/kind.js"

const workflowEntryId = "workflow"
const defaultWorkflowOption = workflowComparisonOptionForId(defaultWorkflowComparisonId)
const WorkflowEntryRequestJson = Schema.parseJson(EntryRunRequest)
const encodeWorkflowEntryRequestJson = Schema.encodeSync(WorkflowEntryRequestJson)
const defaultWorkflowDraft = defaultWorkflowEntryDraft

const workflowDraftFromSnapshot = (snapshot: SurfaceRuntimeSnapshot) => {
  const draft = snapshot.draft

  return draft !== null && draft.entryId === workflowEntryId ? draft : null
}

const workflowStreamUrl = (
  snapshot: SurfaceRuntimeSnapshot,
  runToken: string | null
): string => {
  const draft = workflowDraftFromSnapshot(snapshot) ?? defaultWorkflowDraft
  const params = new URLSearchParams({
    request: encodeWorkflowEntryRequestJson({
      runToken: runToken ?? `${workflowEntryId}:stream`,
      draft
    })
  })

  return `${entryStreamPath(workflowEntryId)}?${params.toString()}`
}

export const entryRuntimeAdapterDescriptor = makeEntryRuntimeAdapterDescriptor({
  entryId: workflowEntryId,
  diagnosticsKey: "workflow-comparison/runtime",
  interactiveWidgetKey: "workflow-comparison/control",
  projectionDriverKey: null,
  runtime: makeServerOnlyStreamingSurfaceRuntime({
    snapshot: (registry) => {
      const frozenDraft = registry.get(surfaceRunStateAtom(workflowEntryId)).session.draft
      const editableDraft = registry.get(surfaceDraftAtom(workflowEntryId))

      return {
        draft: frozenDraft !== null && frozenDraft.entryId === workflowEntryId
          ? frozenDraft
          : editableDraft.entryId === workflowEntryId
          ? editableDraft
          : defaultWorkflowDraft,
        localProjectionScript: null
      }
    },
    streamUrl: workflowStreamUrl
  }),
  surface: {
    interactiveWidget: <WorkflowControl />,
    projectionPlaneHint: {
      stage:
        "Run one frozen workflow comparison at a time and let the browser project canonical graph steps, transcript outputs, and rendered comparisons from the same server-authored stream.",
      evidence:
        "Every workflow-comparison run accumulates graph deltas, node outputs, score changes, and study evidence on one ordered ledger.",
      source:
        `${defaultWorkflowOption.label} is the default proving route; switch scenarios before running to freeze a different graph comparison.`
    },
    diagnosticsSections: () => []
  }
})
