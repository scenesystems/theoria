import type { ReactNode } from "react"

import { detailListClassName } from "../../recipes/detail-list.recipe.js"
import { Box, withClassName } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"

import { DetailRow, type DetailRowProps } from "./DetailRow.js"

export type DetailListProps = {
  readonly className?: string
  readonly emptyText?: ReactNode
  readonly items: ReadonlyArray<DetailRowProps>
}

export const DetailList = ({ className, emptyText, items }: DetailListProps) =>
  items.length === 0
    ? (emptyText === undefined
      ? null
      : <SemanticText role="pane-meta">{emptyText}</SemanticText>)
    : (
      <Box className={detailListClassName(withClassName(className))}>
        {items.map((item, index) => <DetailRow key={String(index)} {...item} />)}
      </Box>
    )
