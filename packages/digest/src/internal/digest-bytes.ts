/** Exact-byte algorithm dispatch and tagged digest construction. @internal */

import { Effect, Match } from "effect"

import { blake3Hash } from "../algorithms/blake3.js"
import { sha256 } from "../algorithms/sha256.js"
import { toBase64Url } from "../encoding.js"
import type { DigestAlgorithm } from "../schemas/DigestAlgorithm.js"

export const hashBytes = (algorithm: DigestAlgorithm, bytes: Uint8Array): Effect.Effect<Uint8Array> =>
  Match.value(algorithm).pipe(
    Match.when("blake3-256", () => blake3Hash(bytes)),
    Match.when("sha256", () => sha256(bytes)),
    Match.exhaustive
  )

export const digestBytesTagged = (algorithm: DigestAlgorithm, bytes: Uint8Array): Effect.Effect<string> =>
  Effect.map(hashBytes(algorithm, bytes), (digest) => `${algorithm}:${toBase64Url(digest)}`)
