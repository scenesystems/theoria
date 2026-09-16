import { PreparationKey, Text, type TextMeasurer } from "@scenesystems/effect-text"
import { Data, Effect, Number } from "effect"

import {
  layoutRequestFor,
  maxWidthFor,
  prepareInputFor,
  TextProjection,
  TextProjectionRequest
} from "../../../contracts/text.js"
import { browserEngineProfile, browserSupportProfileId, type BrowserTextLayout } from "../../text/browserTextLayout.js"

const TextPrepareRequest = TextProjectionRequest.pick("role", "text")
type TextPrepareRequest = typeof TextPrepareRequest.Type

/** The contract's layout for the role and variant, narrowed to the measure the surface can actually offer. */
const layoutRequestWithWidth = (request: TextProjectionRequest, maxWidth: number): Text.Request => {
  const contractLayout = layoutRequestFor(request.role, request.variant)

  return { ...contractLayout, maxWidth: Number.min(contractLayout.maxWidth, maxWidth) }
}

/**
 * The identity a prepared handle is kept under: the text and its role's
 * preparation, the engine, and the revision of the faces it was measured at
 * (`fontReadinessRevisionAtom`) — a handle prepared in a stand-in is the
 * stand-in's, and the served face's arrival is a new identity.
 */
export const prepareIdentityForTextProjection = (
  { role, text }: TextPrepareRequest,
  fontReadinessRevision: PreparationKey.Revision
): PreparationKey.PreparationKey =>
  new PreparationKey.PreparationKey({
    prepare: prepareInputFor(role, text),
    engineProfile: browserEngineProfile,
    supportProfileId: browserSupportProfileId,
    fontReadinessRevision
  })

export const prepareTextProjection = (
  identity: PreparationKey.PreparationKey
): Effect.Effect<Text.WithSegments, TextMeasurer.Failed, BrowserTextLayout> =>
  prepareBrowserText(PreparationKey.toInput(identity))

/** Prepares text against the runtime's layout services; `browserTextLayoutLayer` provides them. */
export const prepareBrowserText = (
  prepare: Text.Input
): Effect.Effect<Text.WithSegments, TextMeasurer.Failed, BrowserTextLayout> => Text.prepareWithSegments(prepare)

export class ProjectPreparedTextOptions extends Data.Class<{
  readonly prepared: Text.WithSegments
  readonly request: TextProjectionRequest
  readonly maxWidth: number
}> {}

export const projectPreparedText = ({
  maxWidth,
  prepared,
  request
}: ProjectPreparedTextOptions): TextProjection => {
  const layout = layoutRequestWithWidth(request, maxWidth)
  const projection = Text.layout(prepared, layout)

  return TextProjection.make({
    role: request.role,
    variant: request.variant,
    text: request.text,
    layout,
    summary: projection.summary,
    lines: projection.lines
  })
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
  prepareTextProjection(prepareIdentityForTextProjection(request, PreparationKey.initialRevision)).pipe(
    Effect.map((prepared) => projectPreparedText({ prepared, request, maxWidth }))
  )
