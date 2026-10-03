import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"
import {
  ApiPageJson,
  DocsApiExportPageJson,
  DocsApiModuleIndexJson,
  DocsAssetPath,
  DocsDataError,
  DocsManifestJson,
  DocsSearchIndexJson,
  GuideHeading,
  GuidePageJson
} from "../src/index.js"

// Literal wire documents, independent of the codecs under test.
const packageJson =
  "{\"name\":\"@scenesystems/effect-search\",\"version\":\"1.2.3\",\"slug\":\"effect-search\",\"description\":\"Search\"}"
const documentationJson =
  "{\"summary\":[{\"kind\":\"text\",\"text\":\"Read \"},{\"kind\":\"code\",\"text\":\"run\"},{\"kind\":\"link\",\"text\":\"source\",\"href\":null}],\"remarks\":[],\"examples\":[{\"language\":\"ts\",\"code\":\"yield* run()\",\"parts\":[]}],\"deprecated\":null,\"see\":[]}"
const moduleJson =
  `{"kind":"entrypoint","name":"Study","subpath":"./Study","slug":"Study","source":"src/Study.ts","docs":${documentationJson},"since":"1.0.0","sourceUrl":"https://example.com/Study.ts"}`
const exportJson =
  "{\"id\":\"Study#run\",\"name\":\"run\",\"anchor\":\"api-run\",\"importKind\":\"value\",\"category\":\"operations\",\"since\":\"1.0.0\",\"summary\":\"Run a study.\",\"facets\":[]}"
const searchJson =
  "{\"schemaVersion\":1,\"entries\":[{\"id\":\"Study#run\",\"kind\":\"symbol\",\"package\":\"@scenesystems/effect-search\",\"packageSlug\":\"effect-search\",\"name\":\"run\",\"qualifiedName\":\"Study.run\",\"category\":null,\"summary\":\"Run a study.\",\"path\":\"/docs/effect-search/api/Study\",\"anchor\":\"api-run\"}]}"
const guideJson =
  `{"schemaVersion":1,"kind":"guide","path":"/docs/effect-search/start","package":${packageJson},"title":"Start","summary":"Getting started","sourceUrl":"https://example.com/start.md","blocks":[{"kind":"heading","depth":2,"id":"intro","text":"Introduction"},{"kind":"paragraph","parts":[{"kind":"text","text":"Use "},{"kind":"code","text":"run"},{"kind":"link","text":"API","href":"/docs/effect-search/api"},{"text":"x^2","display":false,"kind":"math"}]},{"kind":"code","language":"ts","source":"yield* run()"},{"text":"x = 2","display":true,"kind":"math"},{"kind":"list","ordered":true,"items":[[{"kind":"text","text":"First"}]]},{"kind":"quote","parts":[{"kind":"text","text":"A quote"}]},{"kind":"table","headers":[[{"kind":"text","text":"Value"}]],"rows":[[[{"kind":"code","text":"2"}]]]}],"anchors":[{"id":"intro","label":"Introduction","depth":2}]}`

const roundTrip = Effect.fnUntraced(function*<A>(codec: Schema.Codec<A, string>, wire: string) {
  const value = yield* Schema.decodeEffect(codec)(wire)
  expect(yield* Schema.encodeEffect(codec)(value)).toBe(wire)
})

describe("documentation wire contracts", () => {
  it.effect("preserves JSON bytes for all six document codecs", () =>
    Effect.gen(function*() {
      yield* roundTrip(
        ApiPageJson,
        `{"schemaVersion":2,"kind":"api-module","path":"/docs/search","canonical":true,"canonicalPath":"/docs/search","aliases":[],"package":${packageJson},"module":${moduleJson},"categories":[{"name":"operations","exportIds":["Study#run"]}],"exports":[${exportJson}]}`
      )
      yield* roundTrip(
        DocsApiModuleIndexJson,
        `{"schemaVersion":2,"kind":"api-module-index","path":"/docs/search","canonical":true,"canonicalPath":"/docs/search","aliases":[],"package":${packageJson},"module":${moduleJson},"categories":[],"exports":[{"id":"Study#run","name":"run","anchor":"api-run","importKind":"value","category":"operations","since":"1.0.0","summary":"Run","asset":"/docs-data/revision/run.json"}]}`
      )
      yield* roundTrip(DocsApiExportPageJson, `{"schemaVersion":1,"kind":"api-export","export":${exportJson}}`)
      yield* roundTrip(
        DocsManifestJson,
        "{\"schemaVersion\":3,\"revision\":\"revision\",\"searchIndexAsset\":\"/docs-data/revision/search.json\",\"packages\":[]}"
      )
      yield* roundTrip(DocsSearchIndexJson, searchJson)
      yield* roundTrip(GuidePageJson, guideJson)
    }))

  it.effect("decodes wire null to None and strings to Some", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeEffect(DocsSearchIndexJson)(searchJson)
      expect(decoded.entries[0]?.category).toEqual(Option.none())
      expect(decoded.entries[0]?.anchor).toEqual(Option.some("api-run"))
    }))

  it.effect("rejects malformed JSON, unsupported versions, invalid paths and heading depths", () =>
    Effect.gen(function*() {
      expect(yield* Schema.decodeEffect(DocsSearchIndexJson)("{").pipe(Effect.flip)).toBeInstanceOf(Schema.SchemaError)
      expect(yield* Schema.decodeEffect(DocsSearchIndexJson)("{\"schemaVersion\":2,\"entries\":[]}").pipe(Effect.flip))
        .toBeInstanceOf(Schema.SchemaError)
      expect(yield* Schema.decodeEffect(DocsAssetPath)("/elsewhere/file.json").pipe(Effect.flip)).toBeInstanceOf(
        Schema.SchemaError
      )
      expect(
        yield* Schema.decodeUnknownEffect(GuideHeading)({ kind: "heading", depth: 1, id: "intro", text: "Intro" }).pipe(
          Effect.flip
        )
      ).toBeInstanceOf(Schema.SchemaError)
      expect(
        yield* Schema.decodeEffect(GuideHeading)({ kind: "heading", depth: 2, id: "", text: "Intro" }).pipe(
          Effect.flip
        )
      ).toBeInstanceOf(Schema.SchemaError)
    }))

  it.effect("retains the encoded error contract and typed recovery", () =>
    Effect.gen(function*() {
      const codec = Schema.fromJsonString(DocsDataError)
      const wire = "{\"_tag\":\"DocsDataError\",\"path\":\"/docs/a\",\"message\":\"Invalid document\"}"
      const error = yield* Schema.decodeEffect(codec)(wire)
      expect(yield* Schema.encodeEffect(codec)(error)).toBe(wire)
      const recovered = yield* Effect.fail(error).pipe(
        Effect.catchTag("DocsDataError", (failure) => Effect.succeed(failure.path))
      )
      expect(recovered).toBe("/docs/a")
    }))
})
