import { Match } from "effect"

import type { MessageContent } from "../../../../contracts/presentation/interactions.js"
import { Box } from "../../../ui/structure/Box.js"
import { SemanticText } from "../../../ui/structure/SemanticText.js"
import { Stack } from "../../../ui/structure/Stack.js"

import { InteractionDetailList } from "./InteractionDetailList.js"
import { InteractionPayloadBlock } from "./InteractionPayloadBlock.js"

const messageTextClassName = (kind: "body" | "thinking" | "meta"): string =>
  Match.value(kind).pipe(
    Match.when("body", () => "text-content-primary"),
    Match.when("thinking", () => "italic text-content-muted"),
    Match.when("meta", () => "uppercase tracking-[0.18em] text-content-subtle"),
    Match.exhaustive
  )

export const InteractionMessageContent = ({ content }: { readonly content: MessageContent }) =>
  Match.value(content).pipe(
    Match.tag(
      "MessageTextContent",
      ({ kind, text }) => (
        <SemanticText className={messageTextClassName(kind)} role={kind === "body" ? "body" : "body-sm"}>
          {text}
        </SemanticText>
      )
    ),
    Match.tag("MessageDetailsContent", ({ rows, title }) => (
      <Stack gap="sm">
        {title === undefined
          ? null
          : (
            <SemanticText role="label" tone="muted">
              {title}
            </SemanticText>
          )}
        <InteractionDetailList
          emptyText="No structured detail rows were preserved for this message."
          items={rows.map((row) => ({ detail: row.value, label: row.label }))}
        />
      </Stack>
    )),
    Match.tag("MessagePayloadContent", ({ payload }) => (
      <Box>
        <InteractionPayloadBlock payload={payload} />
      </Box>
    )),
    Match.exhaustive
  )
