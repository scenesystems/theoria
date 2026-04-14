import type { ReactNode } from "react"

import { ButtonBehavior } from "../../behavior/ButtonBehavior.js"
import {
  transcriptActionClassName,
  type TranscriptAlignment,
  transcriptCardBodyClassName,
  transcriptCardHeaderClassName,
  transcriptCardMetaRowClassName,
  type TranscriptMode,
  type TranscriptTone
} from "../../recipes/transcript.recipe.js"
import { Box, withClassName } from "../../structure/Box.js"
import { Cluster } from "../../structure/Cluster.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"

import { TranscriptRow } from "./TranscriptRow.js"

type TranscriptActionProps = {
  readonly actor?: ReactNode
  readonly align?: TranscriptAlignment
  readonly badges?: ReactNode
  readonly children?: ReactNode
  readonly className?: string
  readonly details?: ReactNode
  readonly input?: ReactNode
  readonly leading?: ReactNode
  readonly meta?: ReactNode
  readonly mode?: TranscriptMode
  readonly onSelect?: () => void
  readonly output?: ReactNode
  readonly selected?: boolean
  readonly supportingText?: ReactNode
  readonly title: ReactNode
  readonly tone?: TranscriptTone
}

export const TranscriptAction = ({
  actor,
  align = "start",
  badges,
  children,
  className,
  details,
  input,
  leading,
  meta,
  mode = "compact",
  onSelect,
  output,
  selected = false,
  supportingText,
  title,
  tone = "quiet"
}: TranscriptActionProps) => {
  const interactive = onSelect !== undefined
  const content = (
    <Stack className={transcriptCardHeaderClassName({})} gap="sm">
      <Box className={transcriptCardMetaRowClassName({})}>
        <Cluster gap="sm">{badges}</Cluster>
        {meta === undefined
          ? null
          : typeof meta === "string" || typeof meta === "number"
          ? <SemanticText role="transcript-meta">{meta}</SemanticText>
          : meta}
      </Box>
      {typeof title === "string" || typeof title === "number"
        ? <SemanticText role="pane-title">{title}</SemanticText>
        : title}
      {actor === undefined
        ? null
        : typeof actor === "string" || typeof actor === "number"
        ? <SemanticText role="transcript-actor">{actor}</SemanticText>
        : actor}
      {supportingText === undefined
        ? null
        : typeof supportingText === "string" || typeof supportingText === "number"
        ? <SemanticText role="transcript-meta">{supportingText}</SemanticText>
        : supportingText}
      {children === undefined && details === undefined && input === undefined && output === undefined
        ? null
        : (
          <Box className={transcriptCardBodyClassName({})}>
            {children}
            {details}
            {input}
            {output}
          </Box>
        )}
    </Stack>
  )

  return (
    <TranscriptRow align={align} leading={leading}>
      {interactive
        ? (
          <ButtonBehavior
            aria-label={`Inspect transcript action ${String(title)}`}
            aria-pressed={selected}
            className={transcriptActionClassName({ interactive, mode, selected, tone, ...withClassName(className) })}
            onClick={() => {
              onSelect?.()
            }}
            type="button"
          >
            {content}
          </ButtonBehavior>
        )
        : (
          <Box
            className={transcriptActionClassName({ interactive, mode, selected, tone, ...withClassName(className) })}
          >
            {content}
          </Box>
        )}
    </TranscriptRow>
  )
}
