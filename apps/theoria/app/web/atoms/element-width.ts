import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Option } from "effect"

export const elementWidthAtom: (id: string) => AtomType.Writable<number> = Atom.family(
  (_id: string) => Atom.make(0).pipe(Atom.keepAlive)
)

export const makeWidthObserver = (
  setter: (value: number | ((prev: number) => number)) => void
): (element: HTMLElement | null) => void => {
  const state: { current: Option.Option<ResizeObserver> } = { current: Option.none() }

  return (element: HTMLElement | null) => {
    Option.match(state.current, {
      onNone: () => undefined,
      onSome: (observer) => {
        observer.disconnect()
        state.current = Option.none()
      }
    })

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

    state.current = Option.some(observer)
    observer.observe(element)
  }
}
