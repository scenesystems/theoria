import { Schema } from "effect"

import { defaultWorkflowEntryDraft } from "../../../contracts/entry/defaults.js"
import { workflowEntryId } from "../../../contracts/entry/id.js"
import { EntryRunRequest } from "../../../contracts/entry/registry.js"
import { surfaceDraftAtom, surfaceRunStateAtom } from "../../atoms/surface/state.js"
import { entryStreamPath } from "../../services/EntryClient.js"
import { SurfaceRuntime, type SurfaceRuntimeSnapshot } from "../kernel/kind.js"

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
