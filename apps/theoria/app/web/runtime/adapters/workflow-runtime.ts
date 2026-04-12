import { Schema } from "effect"

import { EntryStreamRoute } from "../../../contracts/entry/api-route.js"
import { workflowEntryDescriptor } from "../../../contracts/entry/descriptors/workflow.js"
import { workflowEntryId } from "../../../contracts/entry/id.js"
import { EntryRunRequest } from "../../../contracts/entry/registry.js"
import { surfaceDraftAtom, surfaceRunStateAtom } from "../../atoms/surface/state.js"
import { SurfaceRuntime, type SurfaceRuntimeSnapshot } from "../kernel/kind.js"

const WorkflowEntryRequestJson = Schema.parseJson(EntryRunRequest)
const encodeWorkflowEntryRequestJson = Schema.encodeSync(WorkflowEntryRequestJson)
const defaultWorkflowDraft = workflowEntryDescriptor.defaultDraft()

const workflowDraftFromSnapshot = (snapshot: SurfaceRuntimeSnapshot) => {
  const draft = snapshot.draft

  return draft !== null && draft.entryId === workflowEntryId ? draft : null
}

const workflowStreamUrl = (
  snapshot: SurfaceRuntimeSnapshot,
  runToken: string | null
): string => {
  const draft = workflowDraftFromSnapshot(snapshot) ?? defaultWorkflowDraft

  return EntryStreamRoute.fromEntryId(workflowEntryId).url(
    encodeWorkflowEntryRequestJson({
      runToken: runToken ?? `${workflowEntryId}:stream`,
      draft
    })
  )
}

export const workflowSurfaceRuntime = SurfaceRuntime.serverOnlyStreaming({
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
})
