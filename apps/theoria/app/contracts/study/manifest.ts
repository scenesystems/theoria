import { Match, Schema } from "effect"

import type { StudyDraft, WorkflowStudyDraft } from "./registry.js"
import { WorkflowRunControls } from "./workflow/controls.js"
import { WorkflowStudyInput } from "./workflow/input.js"
import { WorkflowSeedIdSchema } from "./workflow/manifest.js"

export class WorkflowManifest extends Schema.TaggedClass<WorkflowManifest>()("workflow", {
  input: WorkflowStudyInput,
  seedId: WorkflowSeedIdSchema,
  controls: WorkflowRunControls
}) {
  static fromRunRequest(runRequest: {
    readonly input: WorkflowStudyDraft["input"]
    readonly seedId: WorkflowStudyDraft["seedId"]
    readonly controls: WorkflowStudyDraft["controls"]
  }): WorkflowManifest {
    return WorkflowManifest.make({
      input: runRequest.input,
      seedId: runRequest.seedId,
      controls: runRequest.controls
    })
  }

  static fromStudyDraft(draft: WorkflowStudyDraft): WorkflowManifest {
    return WorkflowManifest.fromRunRequest({
      input: draft.input,
      seedId: draft.seedId,
      controls: draft.controls
    })
  }
}

export const StudyManifest = WorkflowManifest

export type StudyManifest = typeof StudyManifest.Type

export const studyManifestFromDraft = (draft: StudyDraft): StudyManifest | null =>
  Match.value(draft).pipe(
    Match.withReturnType<StudyManifest | null>(),
    Match.when({ entryId: "workflow" }, WorkflowManifest.fromStudyDraft),
    Match.orElse(() => null)
  )

export const encodeStudyManifest = Schema.encodeSync(Schema.parseJson(StudyManifest))
export const decodeStudyManifest = Schema.decodeUnknownOption(Schema.parseJson(StudyManifest))
