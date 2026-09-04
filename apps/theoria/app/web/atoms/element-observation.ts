import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { useAtomSet } from "@effect-atom/atom-react"
import { Data, Option, Schema } from "effect"
import * as Arr from "effect/Array"
import { type RefCallback, useMemo } from "react"

export const ElementWidthSlot = Schema.TaggedStruct("ElementWidthSlot", {})
export type ElementWidthSlot = typeof ElementWidthSlot.Type

export class ElementWidthHandle extends Data.Class<{
  readonly ref: RefCallback<HTMLElement>
  readonly slot: ElementWidthSlot
}> {}

export const ActiveAnchorSlot = Schema.TaggedStruct("ActiveAnchorSlot", {})
export type ActiveAnchorSlot = typeof ActiveAnchorSlot.Type

export class ActiveAnchorHandle extends Data.Class<{
  readonly ref: RefCallback<HTMLElement>
  readonly slot: ActiveAnchorSlot
}> {}

export const makeElementWidthSlot = (): ElementWidthSlot => ElementWidthSlot.make({})

export const makeActiveAnchorSlot = (): ActiveAnchorSlot => ActiveAnchorSlot.make({})

export const elementWidthAtom: (slot: ElementWidthSlot) => AtomType.Writable<number> = Atom.family(
  (_slot: ElementWidthSlot) => Atom.make(0)
)

export const activeAnchorAtom: (slot: ActiveAnchorSlot) => AtomType.Writable<string> = Atom.family(
  (_slot: ActiveAnchorSlot) => Atom.make("")
)

const anchorIdsFromKey = (key: string): ReadonlyArray<string> => key.length === 0 ? [] : key.split("\u0000")

const activeAnchor = (ids: ReadonlyArray<string>): string => {
  const first = Arr.head(ids).pipe(Option.getOrElse(() => ""))
  const last = Arr.last(ids).pipe(Option.getOrElse(() => first))

  if (
    globalThis.scrollY > 0 && globalThis.innerHeight + globalThis.scrollY >= document.documentElement.scrollHeight - 2
  ) {
    return last
  }

  return Arr.last(
    Arr.filter(ids, (id) => (document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= 128)
  ).pipe(
    Option.getOrElse(() => first)
  )
}

/**
 * A React 19 ref callback from an observer over a mounted element. React hands
 * `null` on legacy detach; the mounted branch returns the cleanup React runs
 * on unmount, so an absent element has nothing to observe and nothing to undo.
 */
export const observeOnMount =
  <E extends HTMLElement>(observe: (element: E) => () => void): RefCallback<E> => (element) =>
    Option.match(Option.fromNullable(element), {
      onNone: () => {},
      onSome: observe
    })

const makeActiveAnchorObserver = (
  key: string,
  setter: (value: string) => void
): RefCallback<HTMLElement> =>
  observeOnMount(() => {
    const ids = anchorIdsFromKey(key)
    const update = () => setter(activeAnchor(ids))

    globalThis.addEventListener("scroll", update, { passive: true })
    globalThis.addEventListener("resize", update)
    globalThis.addEventListener("hashchange", update)
    const initialFrame = globalThis.requestAnimationFrame(update)

    return () => {
      globalThis.cancelAnimationFrame(initialFrame)
      globalThis.removeEventListener("scroll", update)
      globalThis.removeEventListener("resize", update)
      globalThis.removeEventListener("hashchange", update)
    }
  })

export const makeWidthObserver = <E extends HTMLElement>(
  setter: (value: number) => void
): RefCallback<E> =>
  observeOnMount((element) => {
    const width = element.clientWidth
    if (width > 0) {
      setter(width)
    }

    const observer = new ResizeObserver((entries) => {
      Option.match(Option.fromNullable(entries.at(0)), {
        onNone: () => {},
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
  })

export const useElementWidthReporter = <E extends HTMLElement>(
  onWidth: (width: number) => void
): RefCallback<E> => useMemo(() => makeWidthObserver(onWidth), [onWidth])

export const useElementWidthHandle = (): ElementWidthHandle => {
  const slot = useMemo(makeElementWidthSlot, [])
  const setWidth = useAtomSet(elementWidthAtom(slot))
  const ref = useMemo(() => makeWidthObserver(setWidth), [setWidth])

  return new ElementWidthHandle({ ref, slot })
}

export const useActiveAnchorHandle = (key: string): ActiveAnchorHandle => {
  const slot = useMemo(makeActiveAnchorSlot, [])
  const setActiveAnchor = useAtomSet(activeAnchorAtom(slot))
  const ref = useMemo(() => makeActiveAnchorObserver(key, setActiveAnchor), [key, setActiveAnchor])

  return new ActiveAnchorHandle({ ref, slot })
}
