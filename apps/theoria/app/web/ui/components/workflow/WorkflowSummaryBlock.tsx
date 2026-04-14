import type { ComponentProps } from "react"

import { InspectorSummaryBlock } from "../inspector/InspectorSummaryBlock.js"

export type WorkflowSummaryBlockProps = ComponentProps<typeof InspectorSummaryBlock>

export const WorkflowSummaryBlock = (props: WorkflowSummaryBlockProps) => <InspectorSummaryBlock {...props} />
