/**
 * Hashes byte and text streams incrementally, compares each result with its
 * one-shot equivalent, and verifies a surrogate pair split across text chunks.
 *
 * Run: bun run examples/04-streaming-digest.ts
 */

import { BunRuntime } from "@effect/platform-bun"
import {
  digestBytesBase64Url,
  digestBytesHex,
  digestByteStreamBase64Url,
  digestByteStreamHex,
  digestUtf8Base64Url,
  digestUtf8StreamBase64Url,
  encodeUtf8
} from "@scenesystems/digest"
import { Effect, Stream } from "effect"

const program = Effect.gen(function*() {
  const chunks = yield* Effect.all([encodeUtf8("stream-"), encodeUtf8("safe-"), encodeUtf8("digest")])
  const whole = yield* encodeUtf8("stream-safe-digest")

  const streamedB64 = yield* digestByteStreamBase64Url("blake3-256", Stream.fromIterable(chunks))
  const oneShotB64 = yield* digestBytesBase64Url("blake3-256", whole)

  const streamedHex = yield* digestByteStreamHex("sha256", Stream.fromIterable(chunks))
  const oneShotHex = yield* digestBytesHex("sha256", whole)

  yield* Effect.log("BLAKE3 stream parity", {
    streamed: streamedB64,
    oneShot: oneShotB64,
    matches: streamedB64 === oneShotB64
  })

  yield* Effect.log("SHA-256 stream parity", {
    streamed: streamedHex,
    oneShot: oneShotHex,
    matches: streamedHex === oneShotHex
  })

  const streamedText = yield* digestUtf8StreamBase64Url(
    "blake3-256",
    Stream.fromIterable(["surrogate-", "\uD83D", "\uDE00"])
  )
  const oneShotText = yield* digestUtf8Base64Url("blake3-256", "surrogate-😀")
  yield* Effect.log("UTF-8 stream parity", {
    streamed: streamedText,
    oneShot: oneShotText,
    matches: streamedText === oneShotText
  })
})

BunRuntime.runMain(program)
