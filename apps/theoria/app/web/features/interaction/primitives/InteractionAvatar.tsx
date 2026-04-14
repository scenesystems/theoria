import { Match } from "effect"

import type { MessageActorModel } from "../../../../contracts/presentation/interactions.js"
import { Box, mergeClassNames } from "../../../ui/structure/Box.js"
import { SemanticText } from "../../../ui/structure/SemanticText.js"

const avatarToneClassName = (role: MessageActorModel["role"]): string =>
  Match.value(role).pipe(
    Match.when("user", () => "border-intent-info-border bg-intent-info-surface text-intent-info-content"),
    Match.when("assistant", () =>
      "border-intent-positive-border bg-intent-positive-surface text-intent-positive-content"),
    Match.when("system", () =>
      "border-border-muted bg-surface-canvas text-content-secondary"),
    Match.when(
      "tool",
      () => "border-intent-attention-border bg-intent-attention-surface text-intent-attention-content"
    ),
    Match.when("runtime", () => "border-intent-danger-border bg-intent-danger-surface text-intent-danger-content"),
    Match.when("custom", () => "border-border-strong bg-surface-sunken text-content-primary"),
    Match.exhaustive
  )

export const InteractionAvatar = ({ actor }: { readonly actor: MessageActorModel }) => (
  <Box
    as="span"
    className={mergeClassNames(
      "inline-flex size-10 shrink-0 items-center justify-center rounded-ui-lg border shadow-ui-chip",
      avatarToneClassName(actor.role)
    )}
    title={actor.label}
  >
    <SemanticText className="text-inherit" role="label" tone="inherit">
      {actor.avatar.fallback}
    </SemanticText>
  </Box>
)
