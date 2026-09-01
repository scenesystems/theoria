import { Atom } from "@effect-atom/atom"

export const docsSearchOpenAtom = Atom.make(false)
export const docsSearchQueryAtom = Atom.make("")
export const docsNavigationOpenAtom = Atom.make(false)
export const docsPackageMenuOpenAtom = Atom.make(false)
export const docsLocationHashAtom = Atom.make("")

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

export const setDocsPackageMenuOpenAtom = Atom.fnSync<boolean>()((open, ctx) => {
  ctx.set(docsPackageMenuOpenAtom, open)
})
