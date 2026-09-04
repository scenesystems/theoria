import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType, Result } from "@effect-atom/atom"
import { Clipboard } from "@effect/platform-browser"
import { Effect, Option, Stream } from "effect"

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
      Effect.sync(() => {
        if (Option.contains(ctx(docsCopiedCodeAtom), source)) {
          ctx.set(docsCopiedCodeAtom, Option.none())
        }
        if (Option.contains(ctx(docsCopyFailedCodeAtom), source)) {
          ctx.set(docsCopyFailedCodeAtom, Option.none())
        }
      })
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

      if (hash.startsWith("#api-")) {
        yield* BrowserWindow.scrollToTop
      }
    }))
)

const isSearchShortcut = (event: KeyboardEvent): boolean =>
  (event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k"

/** ⌘K / Ctrl+K opens the docs search while the docs page is mounted. */
export const docsKeyboardShortcutsAtom: AtomType.Atom<Result.Result<void>> = appRuntime.atom((get) =>
  BrowserDocument.events("keydown").pipe(
    Stream.filter(isSearchShortcut),
    Stream.runForEach((event) =>
      Effect.sync(() => {
        event.preventDefault()
        get.set(docsSearchOpenAtom, true)
      })
    )
  )
)

export const setDocsSearchOpenAtom = Atom.fnSync<boolean>()((open, ctx) => {
  ctx.set(docsSearchOpenAtom, open)

  if (!open) {
    ctx.set(docsSearchQueryAtom, "")
  }
})

export const setDocsNavigationOpenAtom = Atom.fnSync<boolean>()((open, ctx) => {
  ctx.set(docsNavigationOpenAtom, open)
})
