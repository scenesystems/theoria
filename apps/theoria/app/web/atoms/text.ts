import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Result } from "@effect-atom/atom"
import { Layer, Option, Schema } from "effect"

import { SurfaceVariant } from "../../contracts/presentation.js"
import { maxWidthFor, type TextProjection, TextRole } from "../../contracts/text.js"
import { projectText } from "../view/text/authority.js"

import { elementWidthAtom } from "./element-width.js"

type TextProjectionKey = `${typeof TextRole.Type}\0${typeof SurfaceVariant.Type}\0${string}\0${string}`

export const textProjectionKey = (
  role: typeof TextRole.Type,
  variant: typeof SurfaceVariant.Type,
  text: string,
  containerId: string
): TextProjectionKey => `${role}\0${variant}\0${text}\0${containerId}`

const isTextRole = Schema.is(TextRole)
const isSurfaceVariant = Schema.is(SurfaceVariant)

const textRuntime = Atom.runtime(Layer.empty)

export const textProjectionAtom: (key: TextProjectionKey) => AtomType.Atom<TextProjection | null> = Atom.family(
  (key: TextProjectionKey) => {
    const parts = key.split("\0")
    if (parts.length < 4) {
      return Atom.make(() => null)
    }

    const rawRole = parts[0]!
    const rawVariant = parts[1]!
    const text = parts.slice(2, -1).join("\0")
    const containerId = parts[parts.length - 1]!

    if (!isTextRole(rawRole) || !isSurfaceVariant(rawVariant)) {
      return Atom.make(() => null)
    }

    const role = rawRole
    const variant = rawVariant
    const contractMax = maxWidthFor(role, variant)

    const effectiveWidthAtom: AtomType.Atom<number> = Atom.make((get: AtomType.Context) => {
      const containerWidth = containerId.length > 0 ? get(elementWidthAtom(containerId)) : 0
      return containerWidth > 0 ? Math.min(contractMax, containerWidth) : contractMax
    })

    const resultAtom = textRuntime.atom(
      (get: AtomType.Context) => {
        const effectiveWidth = get(effectiveWidthAtom)
        return projectText({ role, variant, text }, effectiveWidth)
      },
      { initialValue: null }
    )

    return Atom.make((get: AtomType.Context) => {
      const result = get(resultAtom)
      return Option.getOrElse(Result.value(result), () => null)
    })
  }
)
