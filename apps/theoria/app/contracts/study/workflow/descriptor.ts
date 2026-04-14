import { workflowEntryId } from "../../entry/id.js"

import { StudyDescriptor } from "../descriptor.js"
import { workflowStudyId } from "../id.js"

import { defaultWorkflowSeedId } from "./catalog-policy.js"
import { WorkflowRunControls } from "./controls.js"
import { WorkflowStudyInput } from "./input.js"
import { WorkflowSeedIdSchema } from "./manifest.js"

export const workflowStudyDescriptor = StudyDescriptor.make({
  studyId: workflowStudyId,
  entryId: workflowEntryId,
  defaultSeedId: defaultWorkflowSeedId,
  defaultInput: WorkflowStudyInput.empty(),
  defaultControls: WorkflowRunControls.defaults(),
  seedIdSchema: WorkflowSeedIdSchema,
  inputSchema: WorkflowStudyInput,
  controlsSchema: WorkflowRunControls
})
