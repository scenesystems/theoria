import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Result } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"
import type { Text } from "@scenesystems/effect-text"
import * as TextReact from "@scenesystems/effect-text/react"
import type { Effect } from "effect"
import { Data, Option, Schema } from "effect"
import { useMemo } from "react"

import { SurfaceVariant } from "../../contracts/presentation.js"
import { maxWidthFor, type TextProjection, TextRole } from "../../contracts/text.js"
import { type BrowserTextLayout, browserTextLayoutLive } from "../text/browserTextLayout.js"
import { prepareIdentityForTextProjection, prepareTextProjection, projectPreparedText } from "../view/text/authority.js"

import {
  elementWidthAtom,
  type ElementWidthHandle,
  ElementWidthSlot,
  useElementWidthHandle
} from "./element-observation.js"

export const TextProjectionRequest = Schema.Struct({
  role: TextRole,
  variant: SurfaceVariant,
  text: Schema.String,
  widthSlot: ElementWidthSlot
})
export type TextProjectionRequest = typeof TextProjectionRequest.Type

/** The projection once the text is prepared; until then the surface renders the browser's own wrapping. */
export class TextProjectionHandle extends Data.Class<{
  readonly projection: Option.Option<TextProjection>
  readonly ref: ElementWidthHandle["ref"]
}> {}

export const TextProjectionAuthorityRequest = TextProjectionRequest.pick("role", "variant", "text")
export type TextProjectionAuthorityRequest = typeof TextProjectionAuthorityRequest.Type

export class TextProjectionAuthority extends Data.Class<{
  readonly prepare: (
    identity: TextReact.PrepareIdentityType
  ) => Effect.Effect<Text.PreparedTextWithSegments, unknown, BrowserTextLayout>
  readonly project: (options: {
    readonly prepared: Text.PreparedTextWithSegments
    readonly request: TextProjectionAuthorityRequest
    readonly maxWidth: number
  }) => TextProjection
}> {}

const makeTextProjectionRequest = ({
  role,
  text,
  variant,
  widthSlot
}: TextProjectionRequest): TextProjectionRequest => ({ role, text, variant, widthSlot })

const textRuntime = Atom.runtime(browserTextLayoutLive)

const defaultTextProjectionAuthority: TextProjectionAuthority = new TextProjectionAuthority({
  prepare: prepareTextProjection,
  project: ({ prepared, request, maxWidth }) => projectPreparedText({ prepared, request, maxWidth })
})

const textProjectionPrepareKey = ({
  role,
  text
}: TextProjectionRequest): string => TextReact.prepareIdentityKey(prepareIdentityForTextProjection({ role, text }))

export const makeTextProjectionAtom = (
  authority: TextProjectionAuthority = defaultTextProjectionAuthority
): (request: TextProjectionRequest) => AtomType.Atom<Option.Option<TextProjection>> => {
  const preparedResultAtom = Atom.family((prepareKey: string) =>
    textRuntime.atom(() => authority.prepare(TextReact.prepareIdentityFromKey(prepareKey)))
  )

  return Atom.family((request: TextProjectionRequest) => {
    const contractMax = maxWidthFor(request.role, request.variant)
    const prepareKey = textProjectionPrepareKey(request)

    const effectiveWidthAtom: AtomType.Atom<number> = Atom.make((get: AtomType.Context) => {
      const containerWidth = get(elementWidthAtom(request.widthSlot))
      return containerWidth > 0 ? Math.min(contractMax, containerWidth) : contractMax
    })

    return Atom.make((get: AtomType.Context) => {
      const effectiveWidth = get(effectiveWidthAtom)
      const preparedResult = get(preparedResultAtom(prepareKey))

      return Result.value(preparedResult).pipe(
        Option.map((prepared) =>
          authority.project({
            prepared,
            request: {
              role: request.role,
              variant: request.variant,
              text: request.text
            },
            maxWidth: effectiveWidth
          })
        )
      )
    })
  })
}

const textProjectionAtom = makeTextProjectionAtom()

export const useTextProjection = ({
  role,
  text,
  variant
}: {
  readonly role: typeof TextRole.Type
  readonly text: string
  readonly variant: typeof SurfaceVariant.Type
}): TextProjectionHandle => {
  const width = useElementWidthHandle()
  const request = useMemo(
    () => makeTextProjectionRequest({ role, text, variant, widthSlot: width.slot }),
    [role, text, variant, width.slot]
  )
  const projection = useAtomValue(textProjectionAtom(request))

  return new TextProjectionHandle({
    projection,
    ref: width.ref
  })
}
