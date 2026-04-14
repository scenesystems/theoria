import * as Arr from "effect/Array"
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

import { type CodeLanguage, highlightCode, normalizeCodeLanguage, tokenClassName } from "./code-highlighter.js"

type HighlightedCodeProps = {
  readonly className?: string
  readonly code: string
  readonly label?: ReactNode
  readonly language?: CodeLanguage | string
  readonly meta?: ReactNode
  readonly wrap?: boolean
}

const labelContent = (label: ReactNode): ReactNode =>
  typeof label === "string" || typeof label === "number"
    ? <SemanticText role="label" tone="muted">{label}</SemanticText>
    : label

const metaContent = (meta: ReactNode): ReactNode =>
  typeof meta === "string" || typeof meta === "number"
    ? <SemanticText role="body-sm" tone="muted">{meta}</SemanticText>
    : meta

const languageBadge = (language: string): ReactNode => <Badge>{language}</Badge>

export const HighlightedCode = ({
  className,
  code,
  label,
  language = "plain",
  meta,
  wrap = false
}: HighlightedCodeProps) => {
  const normalizedLanguage = normalizeCodeLanguage(typeof language === "string" ? language : String(language))
  const lines = highlightCode({ language: normalizedLanguage, source: code })
  const hasHeader = label !== undefined || meta !== undefined || normalizedLanguage !== "plain"

  return (
    <Box className={codeBlockClassName(className === undefined ? {} : { className })}>
      {hasHeader
        ? (
          <Box className={codeBlockHeaderClassName({})}>
            <Stack className="flex-1" gap="xs">
              {label === undefined ? null : labelContent(label)}
              {meta === undefined ? null : metaContent(meta)}
            </Stack>
            <Box className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              {normalizedLanguage === "plain" ? null : languageBadge(normalizedLanguage)}
            </Box>
          </Box>
        )
        : null}
      <Box className={codeBlockBodyClassName({ hasHeader, wrap })}>
        <Box as="pre" className="m-0 min-w-0">
          <Box as="code" className={codeBlockCodeClassName({ wrap })}>
            {Arr.map(lines, (line, lineIndex) => (
              <Box
                as="span"
                className="grid grid-cols-[minmax(0,1fr)] items-start sm:grid-cols-[2.45rem_minmax(0,1fr)] sm:gap-3"
                key={`${lineIndex}:${line.length}`}
              >
                <Box
                  as="span"
                  className="hidden select-none text-right text-(length:--st-fs-code-meta) font-weight-(--st-fw-code-meta) text-ink-700/65 sm:block"
                >
                  {lineIndex + 1}
                </Box>
                <Box as="span" className={wrap ? "whitespace-pre-wrap" : "whitespace-pre"}>
                  {Arr.map(
                    line,
                    (token, tokenIndex) => (
                      <Box
                        as="span"
                        className={tokenClassName(token.kind)}
                        key={`${lineIndex}:${tokenIndex}:${token.value.length}`}
                      >
                        {token.value.length === 0 ? " " : token.value}
                      </Box>
                    )
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
