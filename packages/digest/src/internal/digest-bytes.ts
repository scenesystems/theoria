/** One-shot and incremental algorithm dispatch with digest construction. @internal */

import { blake3 } from "@noble/hashes/blake3.js"
import type { _BLAKE3 } from "@noble/hashes/blake3.js"
import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js"
import type { _SHA256 } from "@noble/hashes/sha2.js"
import { Effect, Match } from "effect"

import { blake3Hash } from "../algorithms/blake3.js"
import { sha256 } from "../algorithms/sha256.js"
import { toBase64Url } from "../encoding.js"
import type { DigestAlgorithm } from "../schemas/DigestAlgorithm.js"

export type IncrementalHasher = _BLAKE3 | _SHA256

const tagDigest = (algorithm: DigestAlgorithm, digest: Uint8Array): string => `${algorithm}:${toBase64Url(digest)}`

export const makeIncrementalHasherSync = (algorithm: DigestAlgorithm): IncrementalHasher =>
  Match.value(algorithm).pipe(
    Match.when("blake3-256", () => blake3.create()),
    Match.when("sha256", () => nobleSha256.create()),
    Match.exhaustive
  )

export const makeIncrementalHasher = (algorithm: DigestAlgorithm): Effect.Effect<IncrementalHasher> =>
  Effect.sync(() => makeIncrementalHasherSync(algorithm))

export const updateIncrementalHasher = (hasher: IncrementalHasher, bytes: Uint8Array): void => void hasher.update(bytes)

export const finalizeIncrementalHasherSync = (hasher: IncrementalHasher): Uint8Array => hasher.digest()

export const finalizeIncrementalHasher = (hasher: IncrementalHasher): Effect.Effect<Uint8Array> =>
  Effect.sync(() => finalizeIncrementalHasherSync(hasher))

export const finalizeIncrementalHasherTaggedSync = (
  algorithm: DigestAlgorithm,
  hasher: IncrementalHasher
): string => tagDigest(algorithm, finalizeIncrementalHasherSync(hasher))

export const finalizeIncrementalHasherTagged = (
  algorithm: DigestAlgorithm,
  hasher: IncrementalHasher
): Effect.Effect<string> => Effect.map(finalizeIncrementalHasher(hasher), (digest) => tagDigest(algorithm, digest))

export const hashBytes = (algorithm: DigestAlgorithm, bytes: Uint8Array): Effect.Effect<Uint8Array> =>
  Match.value(algorithm).pipe(
    Match.when("blake3-256", () => blake3Hash(bytes)),
    Match.when("sha256", () => sha256(bytes)),
    Match.exhaustive
  )

export const digestBytesTagged = (algorithm: DigestAlgorithm, bytes: Uint8Array): Effect.Effect<string> =>
  Effect.map(hashBytes(algorithm, bytes), (digest) => tagDigest(algorithm, digest))
