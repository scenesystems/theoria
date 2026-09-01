import { Atom } from "@effect-atom/atom"
import { Effect } from "effect"

import { prepareDocsSearchIndex } from "@theoria/docs-model"
import { DocsClient } from "../services/DocsClient.js"

export const docsRuntime = Atom.runtime(DocsClient.Default)

export const docsManifestAtom = docsRuntime.atom(
  Effect.gen(function*() {
    const client = yield* DocsClient
    return yield* client.manifest()
  })
).pipe(Atom.keepAlive)

export const docsApiModuleIndexAtom = Atom.family((asset: string) =>
  docsRuntime.atom(
    Effect.gen(function*() {
      const client = yield* DocsClient
      return yield* client.apiModuleIndex(asset)
    })
  ).pipe(Atom.keepAlive)
)

export const docsApiExportAtom = Atom.family((asset: string) =>
  docsRuntime.atom(
    Effect.gen(function*() {
      const client = yield* DocsClient
      return yield* client.apiExport(asset)
    })
  ).pipe(Atom.setIdleTTL("10 minutes"))
)

export const docsGuidePageAtom = Atom.family((asset: string) =>
  docsRuntime.atom(
    Effect.gen(function*() {
      const client = yield* DocsClient
      return yield* client.guidePage(asset)
    })
  ).pipe(Atom.keepAlive)
)

export const docsSearchIndexAtom = Atom.family((asset: string) =>
  docsRuntime.atom(
    Effect.gen(function*() {
      const client = yield* DocsClient
      const searchIndex = yield* client.searchIndex(asset)
      return prepareDocsSearchIndex(searchIndex.entries)
    })
  ).pipe(Atom.keepAlive)
)
