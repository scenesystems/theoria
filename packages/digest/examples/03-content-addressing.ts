/** Canonicalizes unknown values and hashes Schema-encoded wire values. */

import { BunRuntime } from "@effect/platform-bun"
import { CanonicalJson, ContentDigest } from "@scenesystems/digest"
import { Effect, Either, Schema } from "effect"

const Event = Schema.Struct({
  name: Schema.String,
  timestamp: Schema.DateFromString
})

const program = Effect.gen(function*() {
  const first = { z: 1, a: 2, m: 3 }
  const reordered = { a: 2, m: 3, z: 1 }
  const canonical = yield* CanonicalJson.encode(first)
  const canonicalBytes = yield* CanonicalJson.encodeBytes(first)
  yield* Effect.log("Canonical form", { canonical, byteLength: canonicalBytes.length })

  const firstDigest = yield* ContentDigest.fromUnknown("blake3-256", first)
  const reorderedDigest = yield* ContentDigest.fromUnknown("blake3-256", reordered)
  yield* Effect.log("Content address", {
    digest: ContentDigest.toString(firstDigest),
    orderIndependent: ContentDigest.toString(firstDigest) === ContentDigest.toString(reorderedDigest)
  })

  const malformed = yield* Effect.either(CanonicalJson.encode({ value: "\uD800" }))
  yield* Either.match(malformed, {
    onLeft: (error) => Effect.log("Strict Unicode", { rejected: true, errorTag: error._tag }),
    onRight: () => Effect.log("Strict Unicode", { rejected: false })
  })

  const timestamp = yield* Schema.decode(Schema.DateFromString)("2025-01-15T12:00:00Z")
  const eventDigest = yield* ContentDigest.fromSchema(Event, { name: "deploy", timestamp })
  yield* Effect.log("Schema wire digest", ContentDigest.toString(eventDigest))
})

BunRuntime.runMain(program)
