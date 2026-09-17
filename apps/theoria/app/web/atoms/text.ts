import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Result } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"
import type { PreparationKey, Text, TextMeasurer } from "@scenesystems/effect-text"
import { Data, Effect, Number, Option, Schema } from "effect"

import { maxWidthFor, type TextProjection, TextProjectionRequest } from "../../contracts/text.js"
import type { CanvasUnavailable } from "../platform/BrowserDocument.js"
import { type BrowserTextLayout, FontReadiness } from "../text/browserTextLayout.js"
import {
  prepareIdentityForTextProjection,
  prepareTextProjection,
  projectPreparedText,
  type ProjectPreparedTextOptions
} from "../view/text/authority.js"

import { type ElementWidthHandle, useElementWidth } from "./element-observation.js"
import { textLayoutRuntime } from "./text-layout.js"

/**
 * What a surface asks the projection for: the contract request and the width
 * the surface can offer. Structural, so every surface projecting the same text
 * at the same width shares one atom.
 */
export class TextProjectionKey
  extends Schema.Class<TextProjectionKey>("@theoria/app/web/atoms/Text/TextProjectionKey")({
    ...TextProjectionRequest.fields,
    maxWidth: Schema.Number
  })
{}

/**
 * What is prepared, independent of the surface's width and variant: the text
 * in its role. Every surface projecting the same text shares one prepared
 * handle, prepared at whatever revision of the faces the runtime measures at.
 */
class TextPrepareKey extends Schema.Class<TextPrepareKey>("@theoria/app/web/atoms/Text/TextPrepareKey")({
  ...TextProjectionRequest.pick("role", "text").fields
}) {}

/** Why a projection is missing: the text could not be measured, or the document has no canvas to measure on. */
export type TextProjectionError = TextMeasurer.Failed | CanvasUnavailable

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
    identity: PreparationKey.PreparationKey
  ) => Effect.Effect<Text.WithSegments, TextMeasurer.Failed, BrowserTextLayout>
  readonly project: (options: ProjectPreparedTextOptions) => TextProjection
}> {}

const defaultTextProjectionAuthority: TextProjectionAuthority = new TextProjectionAuthority({
  prepare: prepareTextProjection,
  project: projectPreparedText
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
          request: TextProjectionRequest.make({ role: key.role, variant: key.variant, text: key.text }),
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
}: TextProjectionRequest): TextProjectionHandle => {
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
          onSome: (available) => Number.min(contractMax, available)
        })
      })
    )
  )

  return new TextProjectionHandle({
    projection,
    ref: width.ref
  })
}
