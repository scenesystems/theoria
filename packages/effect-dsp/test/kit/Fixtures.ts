import { BunServices } from "@effect/platform-bun"
import * as Digest from "@scenesystems/digest/Digest"
import { Array as Arr, Boolean as Bool, Data, Effect, Equal, FileSystem, Path, Schema } from "effect"
import * as Hex from "effect/encoding/Hex"

export const Evidence = Schema.Literals(["upstream-execution", "upstream-kernel", "local-regression"])
export type Evidence = typeof Evidence.Type

export const Entry = Schema.Struct({
  id: Schema.String,
  file: Schema.String,
  evidence: Evidence,
  sha256: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  generator: Schema.String,
  description: Schema.String
})

export const Manifest = Schema.Struct({
  upstream: Schema.Struct({
    dspy: Schema.Literal("3.4.0"),
    gepa: Schema.Literal("0.1.4"),
    optuna: Schema.Literal("4.9.0"),
    commits: Schema.Record(Schema.String, Schema.String),
    python: Schema.String,
    platform: Schema.String
  }),
  fixtures: Schema.Array(Entry)
})

export class FixtureError extends Data.TaggedError("FixtureError")<{
  readonly id: string
  readonly reason: "missing" | "evidence" | "hash" | "identity"
}> {}

const root = Effect.gen(function*() {
  const path = yield* Path.Path
  const url = yield* Schema.decodeEffect(Schema.URLFromString)(import.meta.url)
  const filename = yield* path.fromFileUrl(url)
  return path.resolve(path.dirname(filename), "../fixtures/dspy")
})

export const manifest = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const raw = yield* fs.readFileString(path.join(yield* root, "manifest.json"))
  return yield* Schema.decodeEffect(Schema.fromJsonString(Manifest))(raw)
}).pipe(Effect.provide(BunServices.layer))

/** Require callers to state their evidence claim before any payload is decoded. */
export const fixture = Effect.fnUntraced(function*(id: string, expectedEvidence: Evidence) {
  const index = yield* manifest
  const entry = yield* Effect.fromOption(
    Arr.findFirst(index.fixtures, (e) => Equal.equals(e.id, id)),
    () => new FixtureError({ id, reason: "missing" })
  )
  yield* Bool.match(Equal.equals(entry.evidence, expectedEvidence), {
    onFalse: () => Effect.fail(new FixtureError({ id, reason: "evidence" })),
    onTrue: () => Effect.void
  })
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const raw = yield* fs.readFileString(path.join(yield* root, entry.file))
  const digest = Hex.encode(yield* Digest.hashString("sha256", raw))
  yield* Bool.match(Equal.equals(digest, entry.sha256), {
    onFalse: () => Effect.fail(new FixtureError({ id, reason: "hash" })),
    onTrue: () => Effect.void
  })
  const doc = yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Struct({
    fixture: Schema.String,
    payload: Schema.Unknown
  })))(raw)
  return yield* Bool.match(Equal.equals(doc.fixture, id), {
    onFalse: () => Effect.fail(new FixtureError({ id, reason: "identity" })),
    onTrue: () => Effect.succeed(doc)
  })
}, Effect.provide(BunServices.layer))
