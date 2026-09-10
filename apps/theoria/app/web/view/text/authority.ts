import { type Errors, Text } from "@scenesystems/effect-text"
import { type FontReadinessRevisionType, initialFontReadinessRevision } from "@scenesystems/effect-text/browser"
import * as TextReact from "@scenesystems/effect-text/react"
import { Effect } from "effect"

import { layoutRequestFor, maxWidthFor, prepareInputFor, TextProjectionRequest } from "../../../contracts/text.js"
import { browserEngineProfile, browserSupportProfileId, type BrowserTextLayout } from "../../text/browserTextLayout.js"

const TextPrepareRequest = TextProjectionRequest.pick("role", "text")
type TextPrepareRequest = typeof TextPrepareRequest.Type

/** The contract's layout for the role and variant, narrowed to the measure the surface can actually offer. */
const layoutRequestWithWidth = (request: TextProjectionRequest, maxWidth: number): Text.LayoutRequestType => {
  const contractLayout = layoutRequestFor(request.role, request.variant)

  return { ...contractLayout, maxWidth: Math.min(contractLayout.maxWidth, maxWidth) }
}

/**
 * The identity a prepared handle is kept under: the text and its role's
 * preparation, the engine, and the revision of the faces it was measured at
 * (`fontReadinessRevisionAtom`) — a handle prepared in a stand-in is the
 * stand-in's, and the served face's arrival is a new identity.
 */
export const prepareIdentityForTextProjection = (
  { role, text }: TextPrepareRequest,
  fontReadinessRevision: FontReadinessRevisionType
): TextReact.PrepareIdentity =>
  TextReact.prepareIdentityFor({
    prepare: prepareInputFor(role, text),
    engineProfile: browserEngineProfile,
    supportProfileId: browserSupportProfileId,
    fontReadinessRevision
  })

export const prepareTextProjection = (
  identity: TextReact.PrepareIdentity
): Effect.Effect<Text.PreparedTextWithSegments, Errors.MeasurementFailed, BrowserTextLayout> =>
  prepareBrowserText(TextReact.prepareInputFromIdentity(identity))

/** Prepares text against the runtime's layout services; `browserTextLayoutLayer` provides them. */
export const prepareBrowserText = (
  prepare: Text.PrepareInputType
): Effect.Effect<Text.PreparedTextWithSegments, Errors.MeasurementFailed, BrowserTextLayout> =>
  Text.prepareWithSegments(prepare)

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

/**
 * Prepares and projects in one step; without a measure, the text runs to the
 * contract's full width. No handle is kept, so the identity is at the first
 * revision of the faces: whatever the layer measures in is what is projected.
 */
export const projectText = (
  request: TextProjectionRequest,
  maxWidth: number = maxWidthFor(request.role, request.variant)
) =>
  prepareTextProjection(prepareIdentityForTextProjection(request, initialFontReadinessRevision())).pipe(
    Effect.map((prepared) => projectPreparedText({ prepared, request, maxWidth }))
  )
