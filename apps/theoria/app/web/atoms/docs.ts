import { Atom } from "@effect-atom/atom"
import { Effect, Option, Schema } from "effect"

export class ClipboardWriteError extends Schema.TaggedError<ClipboardWriteError>()("ClipboardWriteError", {
  cause: Schema.Defect
}) {}

export const docsSearchOpenAtom = Atom.make(false)
export const docsSearchQueryAtom = Atom.make("")
export const docsNavigationOpenAtom = Atom.make(false)
export const docsLocationHashAtom = Atom.make("")
export const docsCopiedCodeAtom = Atom.make(Option.none<string>())
export const docsCopyFailedCodeAtom = Atom.make(Option.none<string>())

export const copyDocsCodeAtom = Atom.fn<string>()((source, ctx) =>
  Effect.tryPromise({
    try: () => globalThis.navigator.clipboard.writeText(source),
    catch: (cause) => new ClipboardWriteError({ cause })
  }).pipe(
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

export const docsLocationHashMountAtom = Atom.make((ctx) => {
  const update = () => {
    const hash = globalThis.location.hash
    ctx.set(docsLocationHashAtom, hash)

    if (hash.startsWith("#api-")) {
      globalThis.scrollTo({ top: 0 })
    }
  }

  ctx.set(docsLocationHashAtom, globalThis.location.hash)
  globalThis.addEventListener("hashchange", update)
  ctx.addFinalizer(() => {
    globalThis.removeEventListener("hashchange", update)
  })

  return null
})

export const docsKeyboardShortcutsAtom = Atom.make((ctx) => {
  const onKeyDown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
      event.preventDefault()
      ctx.set(docsSearchOpenAtom, true)
    }
  }

  document.addEventListener("keydown", onKeyDown)
  ctx.addFinalizer(() => {
    document.removeEventListener("keydown", onKeyDown)
  })

  return null
})

export const setDocsSearchOpenAtom = Atom.fnSync<boolean>()((open, ctx) => {
  ctx.set(docsSearchOpenAtom, open)

  if (!open) {
    ctx.set(docsSearchQueryAtom, "")
  }
})

export const setDocsNavigationOpenAtom = Atom.fnSync<boolean>()((open, ctx) => {
  ctx.set(docsNavigationOpenAtom, open)
})
