import { Option, Schema } from "effect"

import { WorkflowHandoffDraft } from "../../presentation/interactions.js"

export class WorkflowStudyInput extends Schema.Class<WorkflowStudyInput>("WorkflowStudyInput")({
  handoff: Schema.NullOr(WorkflowHandoffDraft)
}) {
  static empty(): WorkflowStudyInput {
    return WorkflowStudyInput.make({ handoff: null })
  }

  static withHandoff(handoff: WorkflowHandoffDraft): WorkflowStudyInput {
    return WorkflowStudyInput.make({ handoff })
  }
}

const WorkflowStudyInputJson = Schema.parseJson(WorkflowStudyInput)

export const encodeWorkflowStudyInputJson = Schema.encodeSync(WorkflowStudyInputJson)
export const decodeWorkflowStudyInputJson = Schema.decodeUnknownOption(WorkflowStudyInputJson)

export const decodeWorkflowStudyInputOrEmpty = (input: string | null): WorkflowStudyInput =>
  input === null
    ? WorkflowStudyInput.empty()
    : decodeWorkflowStudyInputJson(input).pipe(
      Option.getOrElse(() => WorkflowStudyInput.empty())
    )
