import type { ReactNode } from "react"

import {
  payloadBlockBodyClassName,
  payloadBlockClassName,
  payloadBlockCodeClassName,
  payloadBlockHeaderClassName,
  type PayloadBlockMode
} from "../../recipes/payload-block.recipe.js"
import { Box, withClassName } from "../../structure/Box.js"
import { Cluster } from "../../structure/Cluster.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"

type PayloadBlockProps = {
  readonly actions?: ReactNode
  readonly children?: ReactNode
  readonly className?: string
  readonly code?: string
  readonly label?: ReactNode
  readonly meta?: ReactNode
  readonly mode?: PayloadBlockMode
  readonly wrap?: boolean
}

export const PayloadBlock = ({
  actions,
  children,
  className,
  code,
  label,
  meta,
  mode = "constrained",
  wrap = true
}: PayloadBlockProps) => {
  const hasHeader = label !== undefined || meta !== undefined || actions !== undefined

  return (
    <Box className={payloadBlockClassName(withClassName(className))}>
      {hasHeader
        ? (
          <Box className={payloadBlockHeaderClassName({})}>
            <Stack className="flex-1" gap="sm">
              {label === undefined
                ? null
                : typeof label === "string" || typeof label === "number"
                ? <SemanticText role="payload-label">{label}</SemanticText>
                : label}
              {meta === undefined
                ? null
                : typeof meta === "string" || typeof meta === "number"
                ? <SemanticText role="pane-meta">{meta}</SemanticText>
                : meta}
            </Stack>
            {actions === undefined ? null : <Cluster gap="sm">{actions}</Cluster>}
          </Box>
        )
        : null}
      <Box className={payloadBlockBodyClassName({ mode })}>
        {children !== undefined
          ? children
          : code === undefined
          ? null
          : (
            <Box as="pre" className="m-0 min-w-0">
              <Box as="code" className={payloadBlockCodeClassName({ wrap })}>
                {code}
              </Box>
            </Box>
          )}
      </Box>
    </Box>
  )
}
