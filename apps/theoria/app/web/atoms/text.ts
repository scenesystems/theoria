import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Result } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"
import type { Errors, Text } from "@scenesystems/effect-text"
import * as TextReact from "@scenesystems/effect-text/react"
import type { Effect } from "effect"
import { Data, Option } from "effect"

import type { SurfaceVariant } from "../../contracts/presentation.js"
import { maxWidthFor, type TextProjection, type TextProjectionRequest, type TextRole } from "../../contracts/text.js"
import { type BrowserTextLayout, browserTextLayoutLive } from "../text/browserTextLayout.js"
import { prepareIdentityForTextProjection, prepareTextProjection, projectPreparedText } from "../view/text/authority.js"

import { type ElementWidthHandle, useElementWidth } from "./element-observation.js"

/**
 * What a surface asks the projection for: the contract request and the width
 * the surface can offer. Structural, so every surface projecting the same text
 * at the same width shares one atom.
 */
export class TextProjectionKey extends Data.Class<{
  readonly role: TextRole
  readonly variant: SurfaceVariant
  readonly text: string
  readonly maxWidth: number
}> {}

/**
 * The projection as the atom sees it: initial while the text is being
 * prepared, a failure when measurement failed, and the projection once it is
 * ready. The surface renders the browser's own wrapping for the first two and
 * marks the failure so it is visible in the document rather than swallowed.
 */
export class TextProjectionHandle extends Data.Class<{
  readonly projection: Result.Result<TextProjection, Errors.MeasurementFailed>
  readonly ref: ElementWidthHandle["ref"]
}> {}

export class TextProjectionAuthority extends Data.Class<{
  readonly prepare: (
    identity: TextReact.PrepareIdentityType
  ) => Effect.Effect<Text.PreparedTextWithSegments, Errors.MeasurementFailed, BrowserTextLayout>
  readonly project: (options: {
    readonly prepared: Text.PreparedTextWithSegments
    readonly request: TextProjectionRequest
    readonly maxWidth: number
  }) => TextProjection
}> {}

const textRuntime = Atom.runtime(browserTextLayoutLive)

const defaultTextProjectionAuthority: TextProjectionAuthority = new TextProjectionAuthority({
  prepare: prepareTextProjection,
  project: ({ prepared, request, maxWidth }) => projectPreparedText({ prepared, request, maxWidth })
})

const textProjectionPrepareKey = ({ role, text }: TextProjectionKey): string =>
  TextReact.prepareIdentityKey(prepareIdentityForTextProjection({ role, text }))

export const makeTextProjectionAtom = (
  authority: TextProjectionAuthority = defaultTextProjectionAuthority
): (key: TextProjectionKey) => AtomType.Atom<Result.Result<TextProjection, Errors.MeasurementFailed>> => {
  const preparedResultAtom = Atom.family((prepareKey: string) =>
    textRuntime.atom(() => authority.prepare(TextReact.prepareIdentityFromKey(prepareKey)))
  )

  return Atom.family((key: TextProjectionKey) => {
    const prepareKey = textProjectionPrepareKey(key)

    return Atom.make((get: AtomType.Context) =>
      Result.map(get(preparedResultAtom(prepareKey)), (prepared) =>
        authority.project({
          prepared,
          request: { role: key.role, variant: key.variant, text: key.text },
          maxWidth: key.maxWidth
        }))
    )
  })
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
