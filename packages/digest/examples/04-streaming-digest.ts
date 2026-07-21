/**
 * Streaming Digest — hash chunked data with Effect Stream.
 *
 * What this shows: hash byte chunks incrementally with the streaming helpers,
 * compare against one-shot digest helpers for parity, and emit both base64url
 * and hex outputs.
 *
 * Run: bun run examples/04-streaming-digest.ts
 */

import { BunRuntime } from "@effect/platform-bun"
import {
  digestBytesBase64Url,
  digestBytesHex,
  digestByteStreamBase64Url,
  digestByteStreamHex,
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
})

BunRuntime.runMain(program)
