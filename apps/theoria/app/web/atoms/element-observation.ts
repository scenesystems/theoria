import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { RegistryContext, useAtom, useAtomSubscribe } from "@effect-atom/atom-react"
import { Boolean, Data, Effect, Equal, Number, Option, Stream, String } from "effect"
import * as Arr from "effect/Array"
import { type RefCallback, useCallback, useContext, useMemo } from "react"

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
  (element: HTMLElement) =>
    appRuntime.atom(ElementSize.contentWidths(element).pipe(Stream.filter(Number.greaterThan(0)))).pipe(
      Atom.setIdleTTL(0)
    )
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
 * Each component reads its own element slot through useAtom's external-store
 * subscription. The ref mounts the slot before writing, so even a registry
 * using microtask disposal cannot discard it before React subscribes.
 * Neither the slot nor the observation retains an element through idle TTL.
 * Cleanup clears only its own attachment, including StrictMode ref replay.
 */
export const useElementWidth = (): ElementWidthHandle => {
  const registry = useContext(RegistryContext)
  const slot = useMemo(() => Atom.make(Option.none<HTMLElement>()).pipe(Atom.setIdleTTL(0)), [])
  const [element, setElement] = useAtom(slot)
  const ref = useMemo(
    () =>
      observeOnMount<HTMLElement>((mounted) => {
        const unmount = registry.mount(slot)
        setElement(Option.some(mounted))

        return () => {
          setElement((current) => Option.filter(current, (active) => Boolean.not(Equal.equals(active, mounted))))
          unmount()
        }
      }),
    [registry, slot, setElement]
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

const anchorIdsFromKey = (key: string): ReadonlyArray<string> =>
  Boolean.match(String.isEmpty(key), { onTrue: Arr.empty, onFalse: () => String.split(key, "\u0000") })

/** The last anchor whose heading has scrolled past the top band, or the last anchor once the page bottom is reached. */
const activeAnchor = (
  ids: ReadonlyArray<string>
): Effect.Effect<string, never, BrowserWindow.BrowserWindow | BrowserDocument.BrowserDocument> =>
  Effect.gen(function*() {
    const first = Arr.head(ids).pipe(Option.getOrElse(() => ""))
    const last = Arr.last(ids).pipe(Option.getOrElse(() => first))

    return yield* Boolean.match(yield* BrowserWindow.isScrolledToBottom, {
      onTrue: () => Effect.succeed(last),
      onFalse: () =>
        Effect.map(
          Effect.filter(ids, (id) =>
            Effect.map(
              BrowserDocument.elementById(id),
              Option.exists((element) => Number.lessThanOrEqualTo(element.getBoundingClientRect().top, 128))
            )),
          (passed) => Arr.last(passed).pipe(Option.getOrElse(() => first))
        )
    })
  })

/** Re-evaluates after the first frame and on every scroll, resize and fragment change. */
const activeAnchors = (
  ids: ReadonlyArray<string>
): Stream.Stream<string, never, BrowserWindow.BrowserWindow | BrowserDocument.BrowserDocument> =>
  Stream.concat(Stream.fromEffect(nextFrame), BrowserWindow.viewportChanges).pipe(
    Stream.mapEffect(() => activeAnchor(ids))
  )

/**
 * The anchor a table of contents should mark as current, for the anchors named
 * by `key` (ids joined with NUL). Observation runs while any component reads
 * the atom and stops when the last one lets go.
 */
export const activeAnchorAtom: (key: string) => AtomType.Atom<Result.Result<string>> = Atom.family((key: string) =>
  appRuntime.atom(activeAnchors(anchorIdsFromKey(key)))
)
