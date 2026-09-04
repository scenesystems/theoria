import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType, Result } from "@effect-atom/atom"
import { useAtomMount, useAtomSet, useAtomSubscribe } from "@effect-atom/atom-react"
import { Data, Effect, Option, Schema, Stream } from "effect"
import * as Arr from "effect/Array"
import { type RefCallback, useMemo } from "react"

import { nextFrame } from "../platform/AnimationFrame.js"
import * as BrowserDocument from "../platform/BrowserDocument.js"
import * as BrowserWindow from "../platform/BrowserWindow.js"
import * as ElementSize from "../platform/ElementSize.js"
import { appRuntime } from "./runtime.js"

export const ElementWidthSlot = Schema.TaggedStruct("ElementWidthSlot", {})
export type ElementWidthSlot = typeof ElementWidthSlot.Type

export class ElementWidthHandle extends Data.Class<{
  readonly ref: RefCallback<HTMLElement>
  readonly slot: ElementWidthSlot
}> {}

export const makeElementWidthSlot = (): ElementWidthSlot => ElementWidthSlot.make({})

/** The element a slot is watching while it is mounted; the ref callback sets and clears it. */
const observedElementAtom: (slot: ElementWidthSlot) => AtomType.Writable<Option.Option<HTMLElement>> = Atom.family(
  (_slot: ElementWidthSlot) => Atom.make(Option.none<HTMLElement>())
)

/** The last positive content width reported for a slot; zero until its element has been measured. */
export const elementWidthAtom: (slot: ElementWidthSlot) => AtomType.Writable<number> = Atom.family(
  (_slot: ElementWidthSlot) => Atom.make(0)
)

/** Runs the size observation for a slot's element while mounted, writing positive widths into `elementWidthAtom`. */
const elementWidthObservationAtom: (slot: ElementWidthSlot) => AtomType.Atom<Result.Result<void>> = Atom.family(
  (slot: ElementWidthSlot) =>
    appRuntime.atom((get) =>
      Option.match(get(observedElementAtom(slot)), {
        onNone: () => Effect.void,
        onSome: (element) =>
          ElementSize.contentWidths(element).pipe(
            Stream.filter((width) => width > 0),
            Stream.runForEach((width) =>
              Effect.sync(() => {
                get.set(elementWidthAtom(slot), width)
              })
            )
          )
      })
    )
)

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

export const useElementWidthHandle = (): ElementWidthHandle => {
  const slot = useMemo(makeElementWidthSlot, [])
  const setElement = useAtomSet(observedElementAtom(slot))
  useAtomMount(elementWidthObservationAtom(slot))
  const ref = useMemo(
    () =>
      observeOnMount<HTMLElement>((element) => {
        setElement(Option.some(element))

        return () => {
          setElement(Option.none())
        }
      }),
    [setElement]
  )

  return new ElementWidthHandle({ ref, slot })
}

/** Reports the mounted element's content width to `onWidth` instead of keeping it in a slot the caller reads. */
export const useElementWidthReporter = (onWidth: (width: number) => void): RefCallback<HTMLElement> => {
  const handle = useElementWidthHandle()
  useAtomSubscribe(elementWidthAtom(handle.slot), onWidth)

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
