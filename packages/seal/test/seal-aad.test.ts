import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { seal, unseal } from "../src/seal.js"
import { plaintext, validKey } from "./helpers/keys.js"

const associatedData = new Uint8Array([1, 3, 3, 7, 9, 11])
const algorithms: ReadonlyArray<"xchacha20-poly1305" | "aes-256-gcm-siv" | "aes-256-gcm"> = [
  "xchacha20-poly1305",
  "aes-256-gcm-siv",
  "aes-256-gcm"
]

describe("seal associated data", () => {
  it.effect("round-trips with identical associated data across all supported algorithms", () =>
    Effect.forEach(
      algorithms,
      (algorithm) =>
        Effect.gen(function*() {
          const envelope = yield* seal(
            algorithm,
            validKey,
            plaintext,
            {
              keyId: `${algorithm}-primary`,
              keyVersion: 2
            },
            associatedData
          )
          const recovered = yield* unseal(validKey, envelope, associatedData)

          expect(envelope.keyId).toBe(`${algorithm}-primary`)
          expect(envelope.keyVersion).toBe(2)
          expect(recovered).toEqual(plaintext)
        }),
      { discard: true }
    ))
})
