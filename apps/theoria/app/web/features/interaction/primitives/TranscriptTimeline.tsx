import { QueueListIcon } from "@heroicons/react/24/outline"
import { Match } from "effect"

import type { InteractionSurfaceModel } from "../../../../contracts/presentation/interactions.js"
import { Badge } from "../../../ui/components/feedback/Badge.js"
import { EmptyState } from "../../../ui/components/feedback/EmptyState.js"
import { Box } from "../../../ui/structure/Box.js"
import { Inline } from "../../../ui/structure/Inline.js"
import { SemanticText } from "../../../ui/structure/SemanticText.js"
import { Stack } from "../../../ui/structure/Stack.js"

import { interactionItemId } from "../model.js"

import { InteractionActionCard } from "./InteractionActionCard.js"
import { InteractionMessageCard } from "./InteractionMessageCard.js"

export const TranscriptTimeline = ({
  onSelectItem,
  selectedItemId,
  surface
}: {
  readonly onSelectItem: (itemId: string) => void
  readonly selectedItemId: string | null
  readonly surface: InteractionSurfaceModel
}) => (
  <Stack gap="md">
    {surface.turns.length === 0
      ? (
        <EmptyState
          description={surface.emptyText}
          eyebrow="Transcript"
          icon={QueueListIcon}
          title="No normalized interaction turns"
        />
      )
      : surface.turns.map((turn, index) => (
        <Box className="border-l border-border-muted pl-4" key={turn.id}>
          <Stack gap="sm">
            <Inline as="span" gap="sm" wrap>
              <Badge tone="neutral">{`Turn ${String(index + 1).padStart(2, "0")}`}</Badge>
              <SemanticText role="label" tone="muted">
                {`${turn.items.length} preserved interaction item${turn.items.length === 1 ? "" : "s"}`}
              </SemanticText>
            </Inline>
            <Stack as="ol" gap="sm">
              {turn.items.map((item) =>
                Match.value(item).pipe(
                  Match.tag("InteractionMessageItem", ({ message }) => (
                    <InteractionMessageCard
                      key={message.id}
                      message={message}
                      onSelect={() => {
                        onSelectItem(message.id)
                      }}
                      selected={selectedItemId === message.id}
                    />
                  )),
                  Match.tag("InteractionActionItem", (actionItem) => (
                    <InteractionActionCard
                      item={actionItem}
                      key={interactionItemId(actionItem)}
                      onSelect={() => {
                        onSelectItem(actionItem.id)
                      }}
                      selected={selectedItemId === actionItem.id}
                    />
                  )),
                  Match.exhaustive
                )
              )}
            </Stack>
          </Stack>
        </Box>
      ))}
  </Stack>
)
