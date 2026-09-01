import { FileSystem } from "@effect/platform"
import { Context, Effect, Layer, Option, Ref, Schema } from "effect"

import { type DocsManifest, DocsManifestJson } from "@theoria/docs-model"

const fromFileUrl = (url: URL): string => decodeURIComponent(url.pathname)
const manifestPath = fromFileUrl(new URL("../../../dist/docs-data/manifest.json", import.meta.url))

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
  const fileSystem = yield* FileSystem.FileSystem
  const cached = yield* Ref.make(Option.none<DocsManifest>())
  const load = fileSystem.readFileString(manifestPath).pipe(
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

export const DocsCatalogLive = Layer.effect(DocsCatalog, makeDocsCatalog)
