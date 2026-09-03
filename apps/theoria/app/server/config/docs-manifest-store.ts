import { Context, Effect, Layer, Option, Ref, Schema } from "effect"

import { type DocsManifest, DocsManifestJson } from "@theoria/docs-model"

import { StaticStore } from "./static-store.js"

const manifestPathname = "/docs-data/manifest.json"

export class DocsManifestError extends Schema.TaggedError<DocsManifestError>()("DocsManifestError", {
  message: Schema.String
}) {}

export class DocsManifestStore extends Context.Tag("@theoria/app/server/config/DocsManifestStore")<
  DocsManifestStore,
  {
    readonly manifest: Effect.Effect<DocsManifest, DocsManifestError>
  }
>() {}

const makeDocsManifestStore = Effect.gen(function*() {
  const store = yield* StaticStore
  const cached = yield* Ref.make(Option.none<DocsManifest>())
  const load = store.text(manifestPathname).pipe(
    Effect.flatMap(Schema.decode(DocsManifestJson)),
    Effect.mapError((cause) => new DocsManifestError({ message: String(cause) })),
    Effect.tap((manifest) => Ref.set(cached, Option.some(manifest)))
  )
  const manifest = Ref.get(cached).pipe(
    Effect.flatMap(Option.match({
      onNone: () => load,
      onSome: Effect.succeed
    }))
  )

  return DocsManifestStore.of({ manifest })
})

export const DocsManifestStoreLive: Layer.Layer<DocsManifestStore, never, StaticStore> = Layer.effect(
  DocsManifestStore,
  makeDocsManifestStore
)
