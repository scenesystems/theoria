import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { useAtomSubscribe } from "@effect-atom/atom-react"
import { Data, Effect, Option, Stream } from "effect"
import * as Arr from "effect/Array"
import { type RefCallback, useCallback, useMemo, useState } from "react"

import { nextFrame } from "../platform/AnimationFrame.js"
import * as BrowserDocument from "../platform/BrowserDocument.js"
import * as BrowserWindow from "../platform/BrowserWindow.js"
import * as ElementSize from "../platform/ElementSize.js"
import { appRuntime } from "./runtime.js"

/**
 * The content width of a mounted element: initial until the element has a
 * positive width, then every width the browser observes. Keyed by the element
 * itself, so two surfaces measuring the same element share one observer, and
 * the family lets go of the atom with the element. The observer disconnects
 * when the last subscriber leaves.
 */
export const elementWidthAtom: (element: HTMLElement) => AtomType.Atom<Result.Result<number>> = Atom.family(
  (element: HTMLElement) => Atom.make(ElementSize.contentWidths(element).pipe(Stream.filter((width) => width > 0)))
)

/** The width of an element that has not mounted: never measured. */
const unmountedWidthAtom: AtomType.Atom<Result.Result<number>> = Atom.make(() => Result.initial<number>())

/** The mount-scoped measure of an element: the ref that mounts it and the atom that follows its width. */
export class ElementWidthHandle extends Data.Class<{
  readonly ref: RefCallback<HTMLElement>
  readonly width: AtomType.Atom<Result.Result<number>>
}> {}

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

/**
 * Follows the content width of the element the returned ref is attached to.
 *
 * The element exists only after React commits, so it reaches the component
 * the way React measures DOM nodes: a callback ref into component state. It
 * cannot go through a writable atom, because the registry drops an atom that
 * is written before anything mounts it, and refs run in the commit phase
 * while atom mounts run in passive effects. Once the element is in hand, the
 * width is atom state like everything else.
 */
export const useElementWidth = (): ElementWidthHandle => {
  const [element, setElement] = useState<Option.Option<HTMLElement>>(Option.none())
  const ref = useMemo(
    () =>
      observeOnMount<HTMLElement>((mounted) => {
        setElement(Option.some(mounted))

        return () => {
          setElement(Option.none())
        }
      }),
    []
  )

  return new ElementWidthHandle({
    ref,
    width: Option.match(element, { onNone: () => unmountedWidthAtom, onSome: elementWidthAtom })
  })
}

const immediately: { readonly immediate: boolean } = { immediate: true }

/** Reports every measured width of the mounted element to `onWidth`, starting with the current one. */
export const useElementWidthReporter = (onWidth: (width: number) => void): RefCallback<HTMLElement> => {
  const handle = useElementWidth()
  const report = useCallback(
    (width: Result.Result<number>) => Option.match(Result.value(width), { onNone: () => {}, onSome: onWidth }),
    [onWidth]
  )
  useAtomSubscribe(handle.width, report, immediately)

  return handle.ref
}

const anchorIdsFromKey = (key: string): ReadonlyArray<string> => key.length === 0 ? [] : key.split("\u0000")

/** The last anchor whose heading has scrolled past the top band, or the last anchor once the page bottom is reached. */
const activeAnchor = (
  ids: ReadonlyArray<string>
): Effect.Effect<string, never, BrowserWindow.BrowserWindow | BrowserDocument.BrowserDocument> =>
  Effect.gen(function*() {
    const first = Arr.head(ids).pipe(Option.getOrElse(() => ""))
    const last = Arr.last(ids).pipe(Option.getOrElse(() => first))

    if (yield* BrowserWindow.isScrolledToBottom) {
      return last
    }

    const passed = yield* Effect.filter(ids, (id) =>
      Effect.map(
        BrowserDocument.elementById(id),
        Option.exists((element) => element.getBoundingClientRect().top <= 128)
      ))

    return Arr.last(passed).pipe(Option.getOrElse(() => first))
  })

/** Re-evaluates after the first frame and on every scroll, resize and fragment change. */
const activeAnchors = (
  ids: ReadonlyArray<string>
): Stream.Stream<string, never, BrowserWindow.BrowserWindow | BrowserDocument.BrowserDocument> =>
  Stream.concat(
    Stream.fromEffect(nextFrame),
    Stream.mergeAll(
      [
        BrowserWindow.events("scroll", { passive: true }),
        BrowserWindow.events("resize"),
        BrowserWindow.events("hashchange")
      ],
      { concurrency: "unbounded" }
    )
  ).pipe(Stream.mapEffect(() => activeAnchor(ids)))

/**
 * The anchor a table of contents should mark as current, for the anchors named
 * by `key` (ids joined with NUL). Observation runs while any component reads
 * the atom and stops when the last one lets go.
 */
export const activeAnchorAtom: (key: string) => AtomType.Atom<Result.Result<string>> = Atom.family((key: string) =>
  appRuntime.atom(activeAnchors(anchorIdsFromKey(key)))
)
