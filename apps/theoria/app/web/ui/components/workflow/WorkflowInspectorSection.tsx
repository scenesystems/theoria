import type { ComponentProps } from "react"

import { InspectorSection } from "../inspector/InspectorSection.js"

export type WorkflowInspectorSectionProps = ComponentProps<typeof InspectorSection>

export const WorkflowInspectorSection = (props: WorkflowInspectorSectionProps) => <InspectorSection {...props} />
