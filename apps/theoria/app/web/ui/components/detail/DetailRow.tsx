import type { ReactNode } from "react"

import {
  detailLabelCellClassName,
  detailRowClassName,
  detailValueCellClassName
} from "../../recipes/detail-list.recipe.js"
import { Box, withClassName } from "../../structure/Box.js"
import { Cluster } from "../../structure/Cluster.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"

const detailLabelNode = (value: ReactNode): ReactNode =>
  typeof value === "string" || typeof value === "number"
    ? <SemanticText role="detail-label">{value}</SemanticText>
    : value

const detailValueNode = (value: ReactNode): ReactNode =>
  typeof value === "string" || typeof value === "number"
    ? <SemanticText role="detail-value">{value}</SemanticText>
    : value

const detailMetaNode = (value: ReactNode): ReactNode =>
  typeof value === "string" || typeof value === "number"
    ? <SemanticText role="pane-meta">{value}</SemanticText>
    : value

export type DetailRowProps = {
  readonly badge?: ReactNode
  readonly className?: string
  readonly label: ReactNode
  readonly meta?: ReactNode
  readonly metaLabel?: ReactNode
  readonly value: ReactNode
}

export const DetailRow = ({ badge, className, label, meta, metaLabel, value }: DetailRowProps) => (
  <Box className={detailRowClassName(withClassName(className))}>
    <Box className={detailLabelCellClassName({})}>
      {detailLabelNode(label)}
      {badge}
    </Box>
    <Stack className={detailValueCellClassName({})} gap="sm">
      {detailValueNode(value)}
      {meta === undefined
        ? null
        : metaLabel === undefined
        ? detailMetaNode(meta)
        : (
          <Cluster gap="sm" justify="between">
            {detailMetaNode(metaLabel)}
            {detailMetaNode(meta)}
          </Cluster>
        )}
    </Stack>
  </Box>
)
