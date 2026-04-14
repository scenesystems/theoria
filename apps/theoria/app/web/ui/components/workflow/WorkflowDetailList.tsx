import type { ComponentProps } from "react"

import { DetailList } from "../detail/DetailList.js"

export type WorkflowDetailListProps = ComponentProps<typeof DetailList>

export const WorkflowDetailList = (props: WorkflowDetailListProps) => <DetailList {...props} />
