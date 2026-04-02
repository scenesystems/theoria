import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Result } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"
import { Layer, Option, Schema } from "effect"
import { useMemo } from "react"

import { SurfaceVariant } from "../../contracts/presentation.js"
import { maxWidthFor, type TextProjection, TextRole } from "../../contracts/text.js"
import { projectText } from "../view/text/authority.js"

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

const makeTextProjectionRequest = ({
  role,
  text,
  variant,
  widthSlot
}: TextProjectionRequest): TextProjectionRequest => ({ role, text, variant, widthSlot })

const isTextRole = Schema.is(TextRole)
const isSurfaceVariant = Schema.is(SurfaceVariant)

const textRuntime = Atom.runtime(Layer.empty)

const textProjectionAtom: (request: TextProjectionRequest) => AtomType.Atom<TextProjection | null> = Atom.family(
  (request: TextProjectionRequest) => {
    if (!isTextRole(request.role) || !isSurfaceVariant(request.variant)) {
      return Atom.make(() => null)
    }

    const contractMax = maxWidthFor(request.role, request.variant)

    const effectiveWidthAtom: AtomType.Atom<number> = Atom.make((get: AtomType.Context) => {
      const containerWidth = get(elementWidthAtom(request.widthSlot))
      return containerWidth > 0 ? Math.min(contractMax, containerWidth) : contractMax
    })

    const resultAtom = textRuntime.atom(
      (get: AtomType.Context) => {
        const effectiveWidth = get(effectiveWidthAtom)
        return projectText({
          role: request.role,
          variant: request.variant,
          text: request.text
        }, effectiveWidth)
      },
      { initialValue: null }
    )

    return Atom.make((get: AtomType.Context) => {
      const result = get(resultAtom)
      return Option.getOrElse(Result.value(result), () => null)
    })
  }
)

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
