import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Result } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"
import type { Effect } from "effect"
import { Layer, Option, Schema } from "effect"
import type { Text } from "effect-text"
import * as TextReact from "effect-text/react"
import { useMemo } from "react"

import { SurfaceVariant } from "../../contracts/presentation.js"
import { maxWidthFor, type TextProjection, TextRole } from "../../contracts/text.js"
import { prepareIdentityForTextProjection, prepareTextProjection, projectPreparedText } from "../view/text/authority.js"

import {
  elementWidthAtom,
  type ElementWidthHandle,
  type ElementWidthSlot,
  useElementWidthHandle
} from "./element-observation.js"

type TextProjectionRequest = {
  readonly role: typeof TextRole.Type
  readonly variant: typeof SurfaceVariant.Type
  readonly text: string
  readonly widthSlot: ElementWidthSlot
}

type TextProjectionHandle = {
  readonly projection: TextProjection | null
  readonly ref: ElementWidthHandle["ref"]
}

type TextProjectionAuthorityRequest = Readonly<{
  readonly role: TextProjectionRequest["role"]
  readonly variant: TextProjectionRequest["variant"]
  readonly text: TextProjectionRequest["text"]
}>

export type TextProjectionAuthority = {
  readonly prepare: (
    identity: TextReact.PrepareIdentityType
  ) => Effect.Effect<Text.PreparedTextWithSegments, unknown, never>
  readonly project: (options: {
    readonly prepared: Text.PreparedTextWithSegments
    readonly request: TextProjectionAuthorityRequest
    readonly maxWidth: number | null
  }) => TextProjection
}

const makeTextProjectionRequest = ({
  role,
  text,
  variant,
  widthSlot
}: TextProjectionRequest): TextProjectionRequest => ({ role, text, variant, widthSlot })

const isTextRole = Schema.is(TextRole)
const isSurfaceVariant = Schema.is(SurfaceVariant)

const textRuntime = Atom.runtime(Layer.empty)

const defaultTextProjectionAuthority: TextProjectionAuthority = {
  prepare: prepareTextProjection,
  project: ({ prepared, request, maxWidth }) => projectPreparedText({ prepared, request, maxWidth })
}

const textProjectionPrepareKey = ({
  role,
  text
}: Readonly<{
  readonly role: TextProjectionRequest["role"]
  readonly text: TextProjectionRequest["text"]
}>): string => TextReact.prepareIdentityKey(prepareIdentityForTextProjection({ role, text }))

export const makeTextProjectionAtom = (
  authority: TextProjectionAuthority = defaultTextProjectionAuthority
): (request: TextProjectionRequest) => AtomType.Atom<TextProjection | null> => {
  const preparedResultAtom = Atom.family((prepareKey: string) =>
    textRuntime.atom(
      () => authority.prepare(TextReact.prepareIdentityFromKey(prepareKey)),
      { initialValue: null }
    )
  )

  return Atom.family((request: TextProjectionRequest) => {
    if (!isTextRole(request.role) || !isSurfaceVariant(request.variant)) {
      return Atom.make(() => null)
    }

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
        Option.flatMap(Option.fromNullable),
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
        ),
        Option.getOrElse(() => null)
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

  return {
    projection,
    ref: width.ref
  }
}
