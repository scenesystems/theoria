/**
 * Key length and strength validation.
 *
 * All three supported algorithms require 256-bit (32-byte) keys.
 * Validates key length and rejects weak all-zero keys before
 * passing to `@noble/ciphers`.
 *
 * Uses `equalBytes` from `@noble/ciphers` for constant-time
 * weak-key comparison — no timing side-channel on key material.
 *
 * @see {@link InvalidKey} — the error produced on validation failure
 *
 * @internal
 */
import { equalBytes } from "@noble/ciphers/utils.js"
import { Effect } from "effect"
import { InvalidKey } from "../schemas/errors.js"

const KEY_BYTES = 32
const ZERO_KEY = /* @__PURE__ */ new Uint8Array(KEY_BYTES)

/**
 * Validate that `key` is exactly 32 bytes and not all-zero.
 *
 * Returns `Effect.void` on success, fails with `InvalidKey`
 * on validation failure.
 *
 * @internal
 */
export const validateKey = (key: Uint8Array): Effect.Effect<void, InvalidKey> =>
  Effect.gen(function*() {
    yield* Effect.filterOrFail(
      Effect.succeed(key.length),
      (len) => len === KEY_BYTES,
      (len) => new InvalidKey({ expected: KEY_BYTES, received: len })
    )
    yield* Effect.filterOrFail(
      Effect.succeed(equalBytes(key, ZERO_KEY)),
      (isZero) => !isZero,
      () => new InvalidKey({ expected: KEY_BYTES, received: key.length })
    )
  })
