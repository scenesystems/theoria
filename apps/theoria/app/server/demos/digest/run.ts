import { Clock, Effect } from "effect"

import { canonicalize, digest, digestBytes, hmacSha256, toBase64Url, toHex, utf8ToBytes } from "@scenesystems/digest"
import type { Program } from "../../../contracts/presentation.js"
import type { RunData } from "../../../contracts/run.js"

import { executableProgram } from "../program-source.js"

export const preloadProgram: Effect.Effect<Program, unknown, never> = executableProgram(import.meta.url)

const sampleValue = { user: "alice", score: 42, tags: ["demo", "theoria"] }
const permutedValue = { tags: ["demo", "theoria"], score: 42, user: "alice" }
const hmacKeyText = "theoria-webhook-secret"

const measured = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.gen(function*() {
    const startedAt = yield* Clock.currentTimeMillis
    const value = yield* effect
    const endedAt = yield* Clock.currentTimeMillis

    return { value, durationMs: endedAt - startedAt }
  })

export const run: Effect.Effect<RunData, unknown, never> = Effect.gen(function*() {
  const startedAt = yield* Clock.currentTimeMillis

  const canonical = yield* canonicalize(sampleValue)
  const permutedCanonical = yield* canonicalize(permutedValue)
  const canonicalMatch = canonical === permutedCanonical

  const blake3Original = yield* measured(digest("blake3-256", sampleValue))
  const sha256Original = yield* measured(digest("sha256", sampleValue))
  const blake3Permuted = yield* digest("blake3-256", permutedValue)
  const digestMatch = blake3Original.value === blake3Permuted

  const canonicalBytes = utf8ToBytes(canonical)
  const blake3Raw = yield* digestBytes("blake3-256", canonicalBytes)
  const sha256Raw = yield* digestBytes("sha256", canonicalBytes)
  const blake3Hex = toHex(blake3Raw)
  const sha256Hex = toHex(sha256Raw)
  const blake3B64 = toBase64Url(blake3Raw)
  const sha256B64 = toBase64Url(sha256Raw)

  const hmacKey = utf8ToBytes(hmacKeyText)
  const hmacMac = yield* hmacSha256(hmacKey, canonicalBytes)
  const hmacB64 = toBase64Url(hmacMac)

  const runnableProgram = yield* preloadProgram
  const endedAt = yield* Clock.currentTimeMillis

  return {
    id: "digest",
    packageName: "@scenesystems/digest",
    summary: "@scenesystems/digest compared BLAKE3-256 and SHA-256 digests with JCS canonicalization and HMAC.",
    durationMs: endedAt - startedAt,
    program: runnableProgram,
    sections: [
      {
        title: "JCS Canonicalization (RFC 8785)",
        items: [
          { _tag: "Text", label: "Canonical form", value: canonical },
          { _tag: "Text", label: "Key-permuted form", value: permutedCanonical },
          { _tag: "Text", label: "Permutation-invariant", value: String(canonicalMatch) },
          {
            _tag: "Scalar",
            label: "Canonical byte length",
            value: canonicalBytes.length,
            unit: "bytes",
            format: "integer"
          }
        ]
      },
      {
        title: "Algorithm Comparison",
        items: [
          { _tag: "Text", label: "BLAKE3-256 tagged", value: blake3Original.value },
          { _tag: "Text", label: "SHA-256 tagged", value: sha256Original.value },
          {
            _tag: "Comparison",
            label: "Digest time",
            baseline: sha256Original.durationMs,
            improved: blake3Original.durationMs,
            unit: "ms",
            direction: "lower-is-better"
          }
        ]
      },
      {
        title: "Encoding Variants",
        items: [
          { _tag: "Text", label: "BLAKE3 hex (64 chars)", value: blake3Hex },
          { _tag: "Text", label: "SHA-256 hex (64 chars)", value: sha256Hex },
          { _tag: "Text", label: "BLAKE3 base64url (43 chars)", value: blake3B64 },
          { _tag: "Text", label: "SHA-256 base64url (43 chars)", value: sha256B64 },
          { _tag: "Scalar", label: "Hex output length", value: blake3Hex.length, unit: "chars", format: "integer" },
          {
            _tag: "Scalar",
            label: "Base64url output length",
            value: blake3B64.length,
            unit: "chars",
            format: "integer"
          }
        ]
      },
      {
        title: "Determinism",
        items: [
          { _tag: "Text", label: "BLAKE3 original", value: blake3Original.value },
          { _tag: "Text", label: "BLAKE3 permuted", value: blake3Permuted },
          { _tag: "Text", label: "Digests match", value: String(digestMatch) }
        ]
      },
      {
        title: "HMAC-SHA256",
        items: [
          { _tag: "Text", label: "HMAC key", value: hmacKeyText },
          { _tag: "Text", label: "MAC (base64url)", value: hmacB64 },
          { _tag: "Scalar", label: "MAC size", value: hmacMac.length, unit: "bytes", format: "integer" }
        ]
      }
    ]
  }
})
