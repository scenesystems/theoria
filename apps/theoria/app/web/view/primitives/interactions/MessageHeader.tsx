import type { MessageActorModel, MessageAlignment } from "../../../../contracts/presentation/interactions.js"

import { Cluster, Stack } from "../Layout.js"
import { SemanticText } from "../SemanticText.js"
import {
  messageHeaderClassName,
  messageMetaClusterClassName,
  messageMetaTextClassName,
  messageTitleClassName
} from "../theme/message.js"

export const MessageHeader = ({
  actor,
  alignment,
  supportingText = actor.supportingText,
  timestampLabel
}: {
  readonly actor: MessageActorModel
  readonly alignment: MessageAlignment
  readonly supportingText?: string
  readonly timestampLabel?: string
}) => {
  const hasMeta = supportingText !== undefined || timestampLabel !== undefined

  return (
    <Stack className={messageHeaderClassName(alignment)}>
      <SemanticText
        as="span"
        className={messageTitleClassName}
        role="selection-title"
        text={actor.label}
        variant="compact"
      />
      {hasMeta
        ? (
          <Cluster className={messageMetaClusterClassName(alignment)}>
            {supportingText === undefined
              ? null
              : (
                <SemanticText
                  as="span"
                  className={messageMetaTextClassName}
                  role="code-meta"
                  text={supportingText}
                  variant="compact"
                />
              )}
            {timestampLabel === undefined
              ? null
              : (
                <SemanticText
                  as="span"
                  className={messageMetaTextClassName}
                  role="code-meta"
                  text={timestampLabel}
                  variant="compact"
                />
              )}
          </Cluster>
        )
        : null}
    </Stack>
  )
}
