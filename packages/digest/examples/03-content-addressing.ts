/**
 * Content Addressing — deterministic digest pipelines with @scenesystems/digest.
 *
 * What this shows: JCS canonicalization makes key order irrelevant, so two objects
 * with the same keys and values always hash identically. The `digest` function
 * chains canonicalize → hash → encode → tag into a single pipeline. Use
 * `durableFingerprint` for cache keys and `digestSchemaValue` for Schema-aware
 * hashing that respects encoding (e.g. Date → ISO string before hashing).
 *
 * Run: bun run examples/03-content-addressing.ts
 */

import { BunRuntime } from "@effect/platform-bun"
import { canonicalize, digest, digestSchemaValue, durableFingerprint } from "@scenesystems/digest"
import { Effect, Schema } from "effect"

const program = Effect.gen(function*() {
  const obj1 = { z: 1, a: 2, m: 3 }
  const obj2 = { a: 2, m: 3, z: 1 }
  const canon1 = yield* canonicalize(obj1)
  const canon2 = yield* canonicalize(obj2)
  yield* Effect.log("Canonical form", { canonical: canon1, keyOrderInvariant: canon1 === canon2 })

  const tagged = yield* digest("blake3-256", { user: "alice", score: 42 })
  const tagged2 = yield* digest("blake3-256", { score: 42, user: "alice" })
  yield* Effect.log("Tagged digest", { digest: tagged, orderIndependent: tagged === tagged2 })

  const cacheKey = yield* durableFingerprint({ question: "What is 2+2?", model: "gpt-4" })
  yield* Effect.log("Cache key", cacheKey)

  const Event = Schema.Struct({
    name: Schema.String,
    timestamp: Schema.DateFromString
  })

  const event = { name: "deploy", timestamp: Schema.decodeSync(Schema.DateFromString)("2025-01-15T12:00:00Z") }
  const schemaDigest = yield* digestSchemaValue(Event, event)
  const schemaDigest2 = yield* digestSchemaValue(Event, event)
  yield* Effect.log("Schema digest", { digest: schemaDigest, deterministic: schemaDigest === schemaDigest2 })
})

BunRuntime.runMain(program)
