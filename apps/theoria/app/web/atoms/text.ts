import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Result } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"
import type { Errors, Text } from "@scenesystems/effect-text"
import type * as TextReact from "@scenesystems/effect-text/react"
import { Data, Effect, Option, Schema } from "effect"

import { SurfaceVariant } from "../../contracts/presentation.js"
import { maxWidthFor, type TextProjection, type TextProjectionRequest, TextRole } from "../../contracts/text.js"
import type { CanvasUnavailable } from "../platform/BrowserDocument.js"
import { type BrowserTextLayout, FontReadiness } from "../text/browserTextLayout.js"
import { prepareIdentityForTextProjection, prepareTextProjection, projectPreparedText } from "../view/text/authority.js"

import { type ElementWidthHandle, useElementWidth } from "./element-observation.js"
import { textLayoutRuntime } from "./text-layout.js"

/**
 * What a surface asks the projection for: the contract request and the width
 * the surface can offer. Structural, so every surface projecting the same text
 * at the same width shares one atom.
 */
export class TextProjectionKey extends Schema.Class<TextProjectionKey>("TextProjectionKey")({
  role: TextRole,
  variant: SurfaceVariant,
  text: Schema.String,
  maxWidth: Schema.Number
}) {}

/**
 * What is prepared, independent of the surface's width and variant: the text
 * in its role. Every surface projecting the same text shares one prepared
 * handle, prepared at whatever revision of the faces the runtime measures at.
 */
class TextPrepareKey extends Schema.Class<TextPrepareKey>("TextPrepareKey")({
  role: TextRole,
  text: Schema.String
}) {}

/** Why a projection is missing: the text could not be measured, or the document has no canvas to measure on. */
export type TextProjectionError = Errors.MeasurementFailed | CanvasUnavailable

/**
 * The projection as the atom sees it: initial while the text is being
 * prepared, a failure when measurement failed, and the projection once it is
 * ready. The surface renders the browser's own wrapping for the first two and
 * marks the failure so it is visible in the document rather than swallowed.
 */
export class TextProjectionHandle extends Data.Class<{
  readonly projection: Result.Result<TextProjection, TextProjectionError>
  readonly ref: ElementWidthHandle["ref"]
}> {}

export class TextProjectionAuthority extends Data.Class<{
  readonly prepare: (
    identity: TextReact.PrepareIdentity
  ) => Effect.Effect<Text.PreparedTextWithSegments, Errors.MeasurementFailed, BrowserTextLayout>
  readonly project: (options: {
    readonly prepared: Text.PreparedTextWithSegments
    readonly request: TextProjectionRequest
    readonly maxWidth: number
  }) => TextProjection
}> {}

const defaultTextProjectionAuthority: TextProjectionAuthority = new TextProjectionAuthority({
  prepare: prepareTextProjection,
  project: ({ prepared, request, maxWidth }) => projectPreparedText({ prepared, request, maxWidth })
})

export const makeTextProjectionAtom = (
  authority: TextProjectionAuthority = defaultTextProjectionAuthority
): (key: TextProjectionKey) => AtomType.Atom<Result.Result<TextProjection, TextProjectionError>> => {
  // The handle is the revision's: the runtime is built again at the faces'
  // arrival, and prepares the text again in the face the page now shows.
  const preparedResultAtom = Atom.family((key: TextPrepareKey) =>
    textLayoutRuntime.atom(
      Effect.flatMap(FontReadiness, (readiness) =>
        authority.prepare(prepareIdentityForTextProjection(key, readiness.revision)))
    )
  )

  return Atom.family((key: TextProjectionKey) =>
    Atom.make((get: AtomType.Context) => {
      const prepared = get(preparedResultAtom(new TextPrepareKey({ role: key.role, text: key.text })))

      return Result.map(prepared, (prepared) =>
        authority.project({
          prepared,
          request: { role: key.role, variant: key.variant, text: key.text },
          maxWidth: key.maxWidth
        }))
    })
  )
}

const textProjectionAtom = makeTextProjectionAtom()

/** The text projected for its surface: at the measured width once there is one, at the contract's width until then. */
export const useTextProjection = ({
  role,
  text,
  variant
}: {
  readonly role: TextRole
  readonly text: string
  readonly variant: SurfaceVariant
}): TextProjectionHandle => {
  const width = useElementWidth()
  const measured = Result.value(useAtomValue(width.width))
  const contractMax = maxWidthFor(role, variant)
  const projection = useAtomValue(
    textProjectionAtom(
      new TextProjectionKey({
        role,
        variant,
        text,
        maxWidth: Option.match(measured, {
          onNone: () => contractMax,
          onSome: (available) => Math.min(contractMax, available)
        })
      })
    )
  )

  return new TextProjectionHandle({
    projection,
    ref: width.ref
  })
}
