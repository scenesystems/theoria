/**
 * Rejects keys that cannot be used by the package's 256-bit ciphers.
 *
 * Length is checked before the all-zero comparison. The comparison does not
 * exit early based on key contents.
 *
 * @internal
 */
import { equalBytes } from "@noble/ciphers/utils.js"
import { Effect } from "effect"
import { InvalidKey } from "../schemas/errors.js"

const KEY_BYTES = 32
const ZERO_KEY = /* @__PURE__ */ new Uint8Array(KEY_BYTES)

/**
 * Validates that `key` is exactly 32 bytes and not all zero.
 *
 * Fails with `InvalidKey` when either condition is false.
 *
 * @internal
 */
export const validateKey = (key: Uint8Array): Effect.Effect<void, InvalidKey> =>
  Effect.gen(function*() {
    yield* Effect.filterOrFail(
      Effect.succeed(key.length),
      (len) => len === KEY_BYTES,
      (len) =>
        new InvalidKey({
          expected: KEY_BYTES,
          received: len,
          reason: `key must be exactly ${KEY_BYTES} bytes, got ${len}`
        })
    )
    yield* Effect.filterOrFail(
      Effect.succeed(equalBytes(key, ZERO_KEY)),
      (isZero) => !isZero,
      () => new InvalidKey({ expected: KEY_BYTES, received: key.length, reason: "key is all-zero (weak key rejected)" })
    )
  })
