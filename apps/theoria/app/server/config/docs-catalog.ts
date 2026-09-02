import { Context, Effect, Layer, Option, Ref, Schema } from "effect"

import { type DocsManifest, DocsManifestJson } from "@theoria/docs-model"

import { StaticStore } from "./static-store.js"

const manifestPathname = "/docs-data/manifest.json"

export class DocsCatalogError extends Schema.TaggedError<DocsCatalogError>()("DocsCatalogError", {
  message: Schema.String
}) {}

export class DocsCatalog extends Context.Tag("@theoria/app/server/config/DocsCatalog")<
  DocsCatalog,
  {
    readonly manifest: Effect.Effect<DocsManifest, DocsCatalogError>
  }
>() {}

const makeDocsCatalog = Effect.gen(function*() {
  const store = yield* StaticStore
  const cached = yield* Ref.make(Option.none<DocsManifest>())
  const load = store.text(manifestPathname).pipe(
    Effect.flatMap(Schema.decode(DocsManifestJson)),
    Effect.mapError((cause) => new DocsCatalogError({ message: String(cause) })),
    Effect.tap((manifest) => Ref.set(cached, Option.some(manifest)))
  )
  const manifest = Ref.get(cached).pipe(
    Effect.flatMap(Option.match({
      onNone: () => load,
      onSome: Effect.succeed
    }))
  )

  return DocsCatalog.of({ manifest })
})

export const DocsCatalogLive: Layer.Layer<DocsCatalog, never, StaticStore> = Layer.effect(DocsCatalog, makeDocsCatalog)
