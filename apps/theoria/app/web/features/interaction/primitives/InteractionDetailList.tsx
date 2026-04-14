import type { ReactNode } from "react"

import { DetailBadge } from "../../../ui/components/detail/DetailBadge.js"
import { DetailList } from "../../../ui/components/detail/DetailList.js"

export type InteractionDetailListItem = {
  readonly detail: ReactNode
  readonly label: ReactNode
  readonly meta?: ReactNode
}

type InteractionDetailListProps = {
  readonly className?: string
  readonly emptyText: ReactNode
  readonly items: ReadonlyArray<InteractionDetailListItem>
}

const detailBadgeNode = (value: ReactNode): ReactNode =>
  typeof value === "string" || typeof value === "number"
    ? <DetailBadge>{value}</DetailBadge>
    : value

export const InteractionDetailList = ({
  className,
  emptyText,
  items
}: InteractionDetailListProps) => (
  <DetailList
    {...(className === undefined ? {} : { className })}
    emptyText={emptyText}
    items={items.map((item) => ({
      ...(item.meta === undefined ? {} : { badge: detailBadgeNode(item.meta) }),
      label: item.label,
      value: item.detail
    }))}
  />
)
