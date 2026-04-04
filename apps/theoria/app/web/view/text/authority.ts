import { Effect, Option } from "effect"
import { Text } from "effect-text"
import * as TextReact from "effect-text/react"

import { layoutRequestFor, prepareInputFor, type TextProjectionRequest } from "../../../contracts/text.js"
import {
  browserEngineProfile,
  browserFontReadinessRevision,
  browserSupportProfileId,
  browserTextLayoutLayer
} from "../../text/browserTextLayout.js"

type TextPrepareRequest = Readonly<{
  readonly role: TextProjectionRequest["role"]
  readonly text: TextProjectionRequest["text"]
}>

const prepareInputFromIdentity = (identity: TextReact.PrepareIdentityType): Text.PrepareInputType => ({
  text: identity.text,
  font: identity.font,
  whiteSpace: identity.whiteSpace,
  ...Option.fromNullable(identity.hyphenationLocale).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (hyphenationLocale) => ({ hyphenationLocale })
    })
  )
})

const layoutRequestWithWidth = (
  request: TextProjectionRequest,
  maxWidth: number | null
): Text.LayoutRequestType => {
  const contractLayout = layoutRequestFor(request.role, request.variant)

  return maxWidth !== null
    ? { ...contractLayout, maxWidth: Math.min(contractLayout.maxWidth, maxWidth) }
    : contractLayout
}

export const prepareIdentityForTextProjection = ({ role, text }: TextPrepareRequest): TextReact.PrepareIdentityType =>
  TextReact.prepareIdentityFor({
    prepare: prepareInputFor(role, text),
    engineProfile: browserEngineProfile,
    supportProfileId: browserSupportProfileId,
    fontReadinessRevision: browserFontReadinessRevision
  })

export const prepareTextProjection = (
  identity: TextReact.PrepareIdentityType
): Effect.Effect<Text.PreparedTextWithSegments, unknown, never> =>
  prepareBrowserText(prepareInputFromIdentity(identity))

export const prepareBrowserText = (
  prepare: Text.PrepareInputType
): Effect.Effect<Text.PreparedTextWithSegments, unknown, never> =>
  Text.prepareWithSegments(prepare).pipe(Effect.provide(browserTextLayoutLayer))

export const projectPreparedText = ({
  prepared,
  request,
  maxWidth = null
}: {
  readonly prepared: Text.PreparedTextWithSegments
  readonly request: TextProjectionRequest
  readonly maxWidth?: number | null
}) => {
  const layout = layoutRequestWithWidth(request, maxWidth)
  const projection = TextReact.projectPreparedLayout(prepared, layout)

  return {
    role: request.role,
    variant: request.variant,
    text: request.text,
    layout,
    summary: projection.summary,
    lines: projection.lines
  }
}

export const projectText = (request: TextProjectionRequest, maxWidth: number | null = null) =>
  prepareTextProjection(prepareIdentityForTextProjection(request)).pipe(
    Effect.map((prepared) => projectPreparedText({ prepared, request, maxWidth }))
  )
