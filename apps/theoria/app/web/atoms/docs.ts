import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType, Result } from "@effect-atom/atom"
import { Clipboard } from "@effect/platform-browser"
import { Array, Boolean, Effect, Function, Option, Stream, String } from "effect"

import * as BrowserDocument from "../platform/BrowserDocument.js"
import * as BrowserWindow from "../platform/BrowserWindow.js"
import { appRuntime } from "./runtime.js"

export const docsSearchOpenAtom = Atom.make(false)
export const docsSearchQueryAtom = Atom.make("")
export const docsNavigationOpenAtom = Atom.make(false)
export const docsLocationHashAtom = Atom.make("")
export const docsCopiedCodeAtom = Atom.make(Option.none<string>())
export const docsCopyFailedCodeAtom = Atom.make(Option.none<string>())

/**
 * Copies a code sample through the platform `Clipboard` and shows the outcome
 * beside the source for two seconds, unless another copy has replaced it.
 */
export const copyDocsCodeAtom = appRuntime.fn<string>()((source, ctx) =>
  Effect.flatMap(Clipboard.Clipboard, (clipboard) => clipboard.writeString(source)).pipe(
    Effect.matchEffect({
      onFailure: () =>
        Effect.sync(() => {
          ctx.set(docsCopiedCodeAtom, Option.none())
          ctx.set(docsCopyFailedCodeAtom, Option.some(source))
        }),
      onSuccess: () =>
        Effect.sync(() => {
          ctx.set(docsCopiedCodeAtom, Option.some(source))
          ctx.set(docsCopyFailedCodeAtom, Option.none())
        })
    }),
    Effect.zipRight(Effect.sleep("2 seconds")),
    Effect.tap(() =>
      Effect.forEach(
        Array.make(docsCopiedCodeAtom, docsCopyFailedCodeAtom),
        (atom) =>
          Effect.sync(() => ctx.set(atom, Option.none())).pipe(
            Effect.when(() => Option.contains(ctx(atom), source))
          ),
        { discard: true }
      )
    )
  )
)

/** The document's fragment now and after every `hashchange`. */
const locationHashes: Stream.Stream<string, never, BrowserWindow.BrowserWindow> = Stream.concat(
  Stream.fromEffect(BrowserWindow.currentUrl),
  Stream.mapEffect(BrowserWindow.events("hashchange"), () => BrowserWindow.currentUrl)
).pipe(Stream.map((url) => url.hash))

/**
 * Mirrors the fragment into `docsLocationHashAtom` while a docs resource is
 * mounted. API anchors select a page section rather than a position, so they
 * scroll to the top instead of to an element.
 */
export const docsLocationHashMountAtom: AtomType.Atom<Result.Result<void>> = appRuntime.atom((get) =>
  Stream.runForEach(locationHashes, (hash) =>
    Effect.gen(function*() {
      get.set(docsLocationHashAtom, hash)

      yield* BrowserWindow.scrollToTop.pipe(Effect.when(() => String.startsWith("#api-")(hash)))
    }))
)

const isSearchShortcut = (event: KeyboardEvent): boolean =>
  Boolean.match(Boolean.or(event.metaKey, event.ctrlKey), {
    onFalse: Function.constFalse,
    onTrue: () => String.Equivalence(String.toLowerCase(event.key), "k")
  })

/** ⌘K / Ctrl+K opens the docs search while the docs page is mounted. */
export const docsKeyboardShortcutsAtom: AtomType.Atom<Result.Result<void>> = appRuntime.atom((get) =>
  BrowserDocument.preventedKeydowns(isSearchShortcut).pipe(
    Stream.runForEach(() =>
      Effect.sync(() => {
        get.set(docsSearchOpenAtom, true)
      })
    )
  )
).pipe(Atom.setIdleTTL(0))

export const setDocsSearchOpenAtom = Atom.fnSync<boolean>()((open, ctx) => {
  ctx.set(docsSearchOpenAtom, open)

  Boolean.match(open, {
    onTrue: Function.constVoid,
    onFalse: () => ctx.set(docsSearchQueryAtom, "")
  })
})

export const setDocsNavigationOpenAtom = Atom.fnSync<boolean>()((open, ctx) => {
  ctx.set(docsNavigationOpenAtom, open)
})
