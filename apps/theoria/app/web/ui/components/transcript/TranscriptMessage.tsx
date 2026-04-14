import type { ReactNode } from "react"

import { ButtonBehavior } from "../../behavior/ButtonBehavior.js"
import {
  type TranscriptAlignment,
  transcriptCardBodyClassName,
  transcriptCardHeaderClassName,
  transcriptCardMetaRowClassName,
  transcriptMessageClassName,
  type TranscriptMode,
  type TranscriptTone
} from "../../recipes/transcript.recipe.js"
import { Box, withClassName } from "../../structure/Box.js"
import { Cluster } from "../../structure/Cluster.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"

import { TranscriptRow } from "./TranscriptRow.js"

type TranscriptMessageProps = {
  readonly actor: ReactNode
  readonly align?: TranscriptAlignment
  readonly badges?: ReactNode
  readonly children: ReactNode
  readonly className?: string
  readonly leading?: ReactNode
  readonly meta?: ReactNode
  readonly mode?: TranscriptMode
  readonly onSelect?: () => void
  readonly selected?: boolean
  readonly supportingText?: ReactNode
  readonly tone?: TranscriptTone
}

const actorNode = (actor: ReactNode): ReactNode =>
  typeof actor === "string" || typeof actor === "number"
    ? <SemanticText role="transcript-actor">{actor}</SemanticText>
    : actor

export const TranscriptMessage = ({
  actor,
  align = "start",
  badges,
  children,
  className,
  leading,
  meta,
  mode = "expanded",
  onSelect,
  selected = false,
  supportingText,
  tone = "default"
}: TranscriptMessageProps) => {
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
      {actorNode(actor)}
      {supportingText === undefined
        ? null
        : typeof supportingText === "string" || typeof supportingText === "number"
        ? <SemanticText role="transcript-meta">{supportingText}</SemanticText>
        : supportingText}
      <Box className={transcriptCardBodyClassName({})}>{children}</Box>
    </Stack>
  )

  return (
    <TranscriptRow align={align} leading={leading}>
      {interactive
        ? (
          <ButtonBehavior
            aria-label={`Inspect transcript item for ${String(actor)}`}
            aria-pressed={selected}
            className={transcriptMessageClassName({ interactive, mode, selected, tone, ...withClassName(className) })}
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
            className={transcriptMessageClassName({ interactive, mode, selected, tone, ...withClassName(className) })}
          >
            {content}
          </Box>
        )}
    </TranscriptRow>
  )
}
