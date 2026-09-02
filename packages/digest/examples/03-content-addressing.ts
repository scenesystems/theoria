/**
 * Confirms that JCS key ordering produces the same content address, exercises
 * strict malformed-Unicode rejection, and hashes a Schema value after encoding
 * it to wire form.
 *
 * Run: bun run examples/03-content-addressing.ts
 */

import { BunRuntime } from "@effect/platform-bun"
import { canonicalize, canonicalJsonBytes, digest, digestSchemaValue, durableFingerprint } from "@scenesystems/digest"
import { Effect, Either, Schema } from "effect"

const program = Effect.gen(function*() {
  const obj1 = { z: 1, a: 2, m: 3 }
  const obj2 = { a: 2, m: 3, z: 1 }
  const canon1 = yield* canonicalize(obj1)
  const canon2 = yield* canonicalize(obj2)
  const canonicalBytes = yield* canonicalJsonBytes(obj1)
  yield* Effect.log("Canonical form", {
    canonical: canon1,
    byteLength: canonicalBytes.length,
    keyOrderInvariant: canon1 === canon2
  })

  const malformed = yield* Effect.either(canonicalize({ value: "\uD800" }))
  yield* Effect.log("Strict Unicode", {
    rejected: Either.isLeft(malformed),
    errorTag: Either.isLeft(malformed) ? malformed.left._tag : undefined
  })

  const tagged = yield* digest("blake3-256", { user: "alice", score: 42 })
  const tagged2 = yield* digest("blake3-256", { score: 42, user: "alice" })
  yield* Effect.log("Tagged digest", { digest: tagged, orderIndependent: tagged === tagged2 })

  const cacheKey = yield* durableFingerprint({ question: "What is 2+2?", model: "gpt-4" })
  yield* Effect.log("Cache key", cacheKey)

  const Event = Schema.Struct({
    name: Schema.String,
    timestamp: Schema.DateFromString
  })

  const timestamp = yield* Schema.decode(Schema.DateFromString)("2025-01-15T12:00:00Z")
  const event = { name: "deploy", timestamp }
  const schemaDigest = yield* digestSchemaValue(Event, event)
  const schemaDigest2 = yield* digestSchemaValue(Event, event)
  yield* Effect.log("Schema digest", { digest: schemaDigest, deterministic: schemaDigest === schemaDigest2 })
})

BunRuntime.runMain(program)
