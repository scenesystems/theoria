import { Match } from "effect"

import type { MessageContent } from "../../../../contracts/presentation/interactions.js"

import { EvidenceRows } from "../EvidenceRows.js"
import { Layer, Stack } from "../Layout.js"
import { SemanticText } from "../SemanticText.js"
import {
  interactionPayloadClassName,
  interactionPayloadSurfaceClassName,
  interactionSectionClassName,
  interactionSectionTitleClassName
} from "../theme/interaction.js"
import { messageTextClassName } from "../theme/message.js"

export const MessageContentView = ({ content }: { readonly content: MessageContent }) =>
  Match.value(content).pipe(
    Match.tag("MessageTextContent", ({ kind, text }) => (
      <SemanticText
        as="p"
        className={messageTextClassName(kind)}
        role={kind === "body" ? "card-summary" : "status"}
        text={text}
        variant="expanded"
      />
    )),
    Match.tag("MessageDetailsContent", ({ rows, title }) => (
      <Stack className={interactionSectionClassName}>
        {title === undefined
          ? null
          : (
            <SemanticText
              as="span"
              className={interactionSectionTitleClassName}
              role="row-label"
              text={title}
              variant="compact"
            />
          )}
        <EvidenceRows density="compact" rows={rows} variant="expanded" />
      </Stack>
    )),
    Match.tag(
      "MessagePayloadContent",
      ({ payload }) => (
        <Stack className={interactionSectionClassName}>
          <Stack className="gap-2">
            {payload.title === undefined
              ? null
              : (
                <SemanticText
                  as="span"
                  className={interactionSectionTitleClassName}
                  role="row-label"
                  text={payload.title}
                  variant="compact"
                />
              )}
            <Layer className={interactionPayloadSurfaceClassName}>
              <SemanticText
                as="p"
                className={interactionPayloadClassName(payload.format)}
                role="code-block"
                text={payload.payload}
                variant="expanded"
                wrapAuthority="native-browser"
              />
            </Layer>
          </Stack>
        </Stack>
      )
    ),
    Match.exhaustive
  )
