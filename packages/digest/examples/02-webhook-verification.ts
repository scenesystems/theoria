/** Computes byte-level HMAC values and composes Effect's wire encoders. */

import { BunRuntime } from "@effect/platform-bun"
import * as Hmac from "@scenesystems/digest/Hmac"
import * as Utf8 from "@scenesystems/digest/Utf8"
import { Effect } from "effect"
import { Base64Url, Hex } from "effect/encoding"

const program = Effect.gen(function*() {
  const secret = yield* Utf8.encode("whsec_test_secret_key")
  const payload = yield* Utf8.encode("{\"id\":\"evt_1\",\"type\":\"charge.succeeded\",\"amount\":2000}")
  const tampered = yield* Utf8.encode("{\"id\":\"evt_1\",\"type\":\"charge.succeeded\",\"amount\":9999}")

  const authenticator = yield* Hmac.sha256(secret, payload)
  const tamperedAuthenticator = yield* Hmac.sha256(secret, tampered)
  yield* Effect.log("HMAC-SHA256", {
    authenticator: Base64Url.encode(authenticator),
    tamperedDiffers: Hex.encode(authenticator) !== Hex.encode(tamperedAuthenticator)
  })

  const legacyAuthenticator = yield* Hmac.sha1(secret, payload)
  yield* Effect.log("HMAC-SHA1 protocol compatibility", {
    authenticator: Hex.encode(legacyAuthenticator)
  })
})

BunRuntime.runMain(program)
