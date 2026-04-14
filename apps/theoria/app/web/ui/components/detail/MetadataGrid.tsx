import type { ReactNode } from "react"

import { metadataGridCellClassName, metadataGridClassName } from "../../recipes/detail-list.recipe.js"
import { Box, withClassName } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"

type MetadataGridItem = {
  readonly label: ReactNode
  readonly value: ReactNode
}

const metadataNode = (value: ReactNode, role: "detail-label" | "detail-value"): ReactNode =>
  typeof value === "string" || typeof value === "number"
    ? <SemanticText role={role}>{value}</SemanticText>
    : value

type MetadataGridProps = {
  readonly className?: string
  readonly items: ReadonlyArray<MetadataGridItem>
}

export const MetadataGrid = ({ className, items }: MetadataGridProps) => (
  <Box className={metadataGridClassName(withClassName(className))}>
    {items.map((item, index) => (
      <Box className={metadataGridCellClassName({})} key={String(index)}>
        <Stack gap="sm">
          {metadataNode(item.label, "detail-label")}
          {metadataNode(item.value, "detail-value")}
        </Stack>
      </Box>
    ))}
  </Box>
)
