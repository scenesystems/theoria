import type { ReactNode } from "react"

import {
  codeBlockBodyClassName,
  codeBlockClassName,
  codeBlockCodeClassName,
  codeBlockHeaderClassName
} from "../../recipes/code-display.recipe.js"
import { Box } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"
import { Badge } from "../feedback/Badge.js"

type CodeBlockProps = {
  readonly actions?: ReactNode
  readonly className?: string
  readonly code: string
  readonly label?: ReactNode
  readonly language?: ReactNode
  readonly meta?: ReactNode
  readonly wrap?: boolean
}

const codeBlockLabelContent = (label: ReactNode): ReactNode =>
  typeof label === "string" || typeof label === "number"
    ? <SemanticText role="label" tone="muted">{label}</SemanticText>
    : label

const codeBlockMetaContent = (meta: ReactNode): ReactNode =>
  typeof meta === "string" || typeof meta === "number"
    ? <SemanticText role="body-sm" tone="muted">{meta}</SemanticText>
    : meta

const codeBlockLanguageContent = (language: ReactNode): ReactNode =>
  typeof language === "string" || typeof language === "number"
    ? <Badge>{language}</Badge>
    : language

export const CodeBlock = ({
  actions,
  className,
  code,
  label,
  language,
  meta,
  wrap = false
}: CodeBlockProps) => {
  const hasHeader = label !== undefined || meta !== undefined || language !== undefined || actions !== undefined

  return (
    <Box className={codeBlockClassName(className === undefined ? {} : { className })}>
      {hasHeader
        ? (
          <Box className={codeBlockHeaderClassName({})}>
            <Stack className="flex-1" gap="xs">
              {label === undefined ? null : codeBlockLabelContent(label)}
              {meta === undefined ? null : codeBlockMetaContent(meta)}
            </Stack>
            <Box className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              {language === undefined ? null : codeBlockLanguageContent(language)}
              {actions}
            </Box>
          </Box>
        )
        : null}
      <Box className={codeBlockBodyClassName({ hasHeader, wrap })}>
        <Box as="pre" className="m-0 min-w-0">
          <Box as="code" className={codeBlockCodeClassName({ wrap })}>
            {code}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
