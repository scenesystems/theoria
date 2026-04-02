import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { useAtomSet } from "@effect-atom/atom-react"
import { Option } from "effect"
import { type RefCallback, useMemo } from "react"

export type ElementWidthSlot = {
  readonly _tag: "ElementWidthSlot"
}

export type ElementWidthHandle = {
  readonly ref: RefCallback<HTMLElement>
  readonly slot: ElementWidthSlot
}

export const makeElementWidthSlot = (): ElementWidthSlot => ({ _tag: "ElementWidthSlot" })

export const elementWidthAtom: (slot: ElementWidthSlot) => AtomType.Writable<number> = Atom.family(
  (_slot: ElementWidthSlot) => Atom.make(0)
)

export const makeWidthObserver = <E extends HTMLElement>(
  setter: (value: number) => void
): RefCallback<E> =>
(element) => {
  if (element === null) {
    return
  }

  const width = element.clientWidth
  if (width > 0) {
    setter(width)
  }

  const observer = new ResizeObserver((entries) => {
    Option.match(Option.fromNullable(entries.at(0)), {
      onNone: () => undefined,
      onSome: (entry) => {
        const observedWidth = Math.floor(entry.contentRect.width)
        if (observedWidth > 0) {
          setter(observedWidth)
        }
      }
    })
  })

  observer.observe(element)

  return () => {
    observer.disconnect()
  }
}

export const useElementWidthReporter = <E extends HTMLElement>(
  onWidth: (width: number) => void
): RefCallback<E> => useMemo(() => makeWidthObserver(onWidth), [onWidth])

export const useElementWidthHandle = (): ElementWidthHandle => {
  const slot = useMemo(makeElementWidthSlot, [])
  const setWidth = useAtomSet(elementWidthAtom(slot))
  const ref = useMemo(() => makeWidthObserver(setWidth), [setWidth])

  return { ref, slot }
}
