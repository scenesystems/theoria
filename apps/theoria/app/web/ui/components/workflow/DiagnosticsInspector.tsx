import type { ComponentProps, ReactNode } from "react"

import { InspectorDetailList } from "../inspector/InspectorDetailList.js"
import { WorkflowInspector } from "./WorkflowInspector.js"
import { WorkflowInspectorSection } from "./WorkflowInspectorSection.js"

type DiagnosticsInspectorProps = {
  readonly actions?: ReactNode
  readonly children?: ReactNode
  readonly className?: string
  readonly details?: ComponentProps<typeof InspectorDetailList>["items"]
  readonly emptyText?: ReactNode
  readonly footer?: ReactNode
  readonly label?: ReactNode
  readonly payload?: ReactNode
  readonly summary?: ReactNode
  readonly summaryBlock?: ReactNode
  readonly title?: ReactNode
}

export const DiagnosticsInspector = ({
  actions,
  children,
  className,
  details,
  emptyText,
  footer,
  label,
  payload,
  summary,
  summaryBlock,
  title
}: DiagnosticsInspectorProps) => (
  <WorkflowInspector
    {...(actions === undefined ? {} : { actions })}
    {...(className === undefined ? {} : { className })}
    {...(footer === undefined ? {} : { footer })}
    {...(label === undefined ? {} : { label })}
    {...(summary === undefined ? {} : { summary })}
    {...(title === undefined ? {} : { title })}
  >
    {summaryBlock === undefined ? null : <WorkflowInspectorSection>{summaryBlock}</WorkflowInspectorSection>}
    {details === undefined ? null : (
      <WorkflowInspectorSection>
        <InspectorDetailList emptyText={emptyText} items={details} />
      </WorkflowInspectorSection>
    )}
    {payload === undefined ? null : <WorkflowInspectorSection>{payload}</WorkflowInspectorSection>}
    {children}
  </WorkflowInspector>
)
