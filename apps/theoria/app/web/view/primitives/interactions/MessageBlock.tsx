import { Match } from "effect"

import type { MessageContent } from "../../../../contracts/presentation/interactions.js"

import { Cluster, Layer, Stack } from "../Layout.js"
import { SemanticText } from "../SemanticText.js"
import { messageDataBlockClassName, messageDataValueClassName, messageTextClassName } from "../theme/message.js"

export const MessageBlock = ({ block }: { readonly block: MessageContent }) =>
  Match.value(block).pipe(
    Match.tag("MessageTextContent", ({ kind, text }) => (
      <SemanticText
        as="p"
        className={messageTextClassName(kind)}
        role={kind === "body" ? "card-summary" : "status"}
        text={text}
        variant="expanded"
      />
    )),
    Match.tag("MessageDataContent", ({ display, rows, title }) => (
      <Layer className={messageDataBlockClassName(display)}>
        <Stack className="gap-3">
          {title === undefined
            ? null
            : <SemanticText as="span" className="text-ink-500" role="row-label" text={title} variant="compact" />}
          <Stack className="gap-2.5">
            {rows.map((row) => (
              <Cluster className="items-start justify-between gap-3" key={`${row.label}:${row.value}`}>
                <SemanticText as="span" className="text-ink-500" role="row-label" text={row.label} variant="compact" />
                <Layer className="min-w-0 max-w-[28rem] text-right">
                  <SemanticText
                    as="p"
                    className={messageDataValueClassName(display)}
                    role="card-summary"
                    text={row.value}
                    variant="expanded"
                  />
                </Layer>
              </Cluster>
            ))}
          </Stack>
        </Stack>
      </Layer>
    )),
    Match.exhaustive
  )
