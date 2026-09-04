import { Text } from "@scenesystems/effect-text"
import * as TextReact from "@scenesystems/effect-text/react"
import { Effect, Option } from "effect"

import { layoutRequestFor, maxWidthFor, prepareInputFor, TextProjectionRequest } from "../../../contracts/text.js"
import {
  browserEngineProfile,
  browserFontReadinessRevision,
  browserSupportProfileId,
  browserTextLayoutLayer
} from "../../text/browserTextLayout.js"

const TextPrepareRequest = TextProjectionRequest.pick("role", "text")
type TextPrepareRequest = typeof TextPrepareRequest.Type

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

/** The contract's layout for the role and variant, narrowed to the measure the surface can actually offer. */
const layoutRequestWithWidth = (request: TextProjectionRequest, maxWidth: number): Text.LayoutRequestType => {
  const contractLayout = layoutRequestFor(request.role, request.variant)

  return { ...contractLayout, maxWidth: Math.min(contractLayout.maxWidth, maxWidth) }
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
  maxWidth,
  prepared,
  request
}: {
  readonly prepared: Text.PreparedTextWithSegments
  readonly request: TextProjectionRequest
  readonly maxWidth: number
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

/** Prepares and projects in one step; without a measure, the text runs to the contract's full width. */
export const projectText = (
  request: TextProjectionRequest,
  maxWidth: number = maxWidthFor(request.role, request.variant)
) =>
  prepareTextProjection(prepareIdentityForTextProjection(request)).pipe(
    Effect.map((prepared) => projectPreparedText({ prepared, request, maxWidth }))
  )
