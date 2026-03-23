/**
 * Content Addressing — deterministic digest pipelines with @scenesystems/digest.
 *
 * Demonstrates:
 * - `canonicalize` for RFC 8785 JCS canonicalization (key ordering)
 * - `digest` for the full canonicalize → hash → encode → tag pipeline
 * - `durableFingerprint` for cache key identity
 * - `digestSchemaValue` with a Schema.Struct showing Date encoding
 * - Key order doesn't affect output (JCS guarantee)
 *
 * Run: bun run examples/content-addressing.ts
 */

import { canonicalize, digest, digestSchemaValue, durableFingerprint } from "@scenesystems/digest"
import { Effect, Schema } from "effect"

const program = Effect.gen(function*() {
  // --- canonicalize: RFC 8785 JCS key ordering ---
  const obj1 = { z: 1, a: 2, m: 3 }
  const obj2 = { a: 2, m: 3, z: 1 }
  const canon1 = yield* canonicalize(obj1)
  const canon2 = yield* canonicalize(obj2)
  console.log("Canonical form:", canon1)
  console.log("Key order invariant?", canon1 === canon2 ? "✓ yes" : "✗ no")

  // --- digest: full pipeline (canonicalize → hash → base64url → tag) ---
  const tagged = yield* digest("blake3-256", { user: "alice", score: 42 })
  console.log("Tagged digest:", tagged)

  // Same data, different key order → same digest
  const tagged2 = yield* digest("blake3-256", { score: 42, user: "alice" })
  console.log("Order-independent?", tagged === tagged2 ? "✓ yes" : "✗ no")

  // --- durableFingerprint: cache key identity (BLAKE3-256) ---
  const cacheKey = yield* durableFingerprint({ question: "What is 2+2?", model: "gpt-4" })
  console.log("Cache key:", cacheKey)

  // --- digestSchemaValue: Schema.encode → canonicalize → hash ---
  const Event = Schema.Struct({
    name: Schema.String,
    timestamp: Schema.DateFromString
  })

  const event = { name: "deploy", timestamp: new Date("2025-01-15T12:00:00Z") }
  const schemaDigest = yield* digestSchemaValue(Event, event)
  console.log("Schema digest:", schemaDigest)

  // Same event produces the same digest every time
  const schemaDigest2 = yield* digestSchemaValue(Event, event)
  console.log("Deterministic?", schemaDigest === schemaDigest2 ? "✓ yes" : "✗ no")
})

Effect.runPromise(program)
