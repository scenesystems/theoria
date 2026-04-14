import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline"

import { WorkflowStudyRoute } from "../../../../contracts/presentation/path.js"
import type { WorkflowReference } from "../../../../contracts/study/workflow/revision.js"
import { LinkButton } from "../../../ui/components/action/LinkButton.js"

export const OpenInWorkflowAction = ({
  label,
  reference
}: {
  readonly label: string
  readonly reference: WorkflowReference
}) => (
  <LinkButton
    href={WorkflowStudyRoute.fromSessionId(reference.seedId).path()}
    size="sm"
    tone="neutral"
    trailingIcon={ArrowTopRightOnSquareIcon}
  >
    {label}
  </LinkButton>
)
