import { Atom } from "@effect-atom/atom"
import { Effect } from "effect"

import { DocsClient } from "../services/DocsClient.js"

export const docsRuntime = Atom.runtime(DocsClient.Default)

export const docsManifestAtom = docsRuntime.atom(
  Effect.gen(function*() {
    const client = yield* DocsClient
    return yield* client.manifest()
  })
)

export const docsApiPageAtom = Atom.family((asset: string) =>
  docsRuntime.atom(
    Effect.gen(function*() {
      const client = yield* DocsClient
      return yield* client.apiPage(asset)
    })
  )
)

export const docsGuidePageAtom = Atom.family((asset: string) =>
  docsRuntime.atom(
    Effect.gen(function*() {
      const client = yield* DocsClient
      return yield* client.guidePage(asset)
    })
  )
)

export const docsSearchIndexAtom = Atom.family((asset: string) =>
  docsRuntime.atom(
    Effect.gen(function*() {
      const client = yield* DocsClient
      return yield* client.searchIndex(asset)
    })
  )
)
