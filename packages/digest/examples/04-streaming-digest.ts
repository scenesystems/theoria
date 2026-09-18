/** Hashes byte and text streams while preserving stream failures and services. */

import { BunRuntime } from "@effect/platform-bun"
import * as Digest from "@scenesystems/digest/Digest"
import * as Utf8 from "@scenesystems/digest/Utf8"
import { Effect, Encoding, Stream, String as Str } from "effect"

const program = Effect.gen(function*() {
  const chunks = yield* Effect.all([Utf8.encode("stream-"), Utf8.encode("safe-"), Utf8.encode("digest")])
  const whole = yield* Utf8.encode("stream-safe-digest")
  const streamed = yield* Digest.hashStream("blake3-256", Stream.fromIterable(chunks))
  const oneShot = Digest.hash("blake3-256", whole)

  yield* Effect.log("Byte stream parity", {
    streamed: Encoding.encodeBase64Url(streamed),
    matches: Str.Equivalence(Encoding.encodeHex(streamed), Encoding.encodeHex(oneShot))
  })

  const streamedText = yield* Digest.hashStringStream(
    "sha256",
    Stream.fromIterable(["surrogate-", "\uD83D", "\uDE00"])
  )
  const oneShotText = yield* Digest.hashString("sha256", "surrogate-😀")
  yield* Effect.log("Text stream parity", {
    digest: Encoding.encodeHex(streamedText),
    matches: Str.Equivalence(Encoding.encodeHex(streamedText), Encoding.encodeHex(oneShotText))
  })
})

BunRuntime.runMain(program)
