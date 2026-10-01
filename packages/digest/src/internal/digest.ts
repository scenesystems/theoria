/** Invocation-local incremental hash state, never exposed to consumers. @internal */

import { type _BLAKE3, blake3 } from "@noble/hashes/blake3.js"
import { type _SHA256, sha256 } from "@noble/hashes/sha2.js"
import { Match } from "effect"
import type { Algorithm } from "../Digest.js"

export type Hasher = _BLAKE3 | _SHA256

export const makeHasher = (algorithm: Algorithm): Hasher =>
  Match.value(algorithm).pipe(
    Match.when("blake3-256", () => blake3.create()),
    Match.when("sha256", () => sha256.create()),
    Match.exhaustive
  )
