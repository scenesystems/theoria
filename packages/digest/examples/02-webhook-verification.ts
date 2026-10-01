/** Computes byte-level HMAC values and composes Effect's wire encoders. */

import { BunRuntime } from "@effect/platform-bun"
import * as Hmac from "@scenesystems/digest/Hmac"
import * as Utf8 from "@scenesystems/digest/Utf8"
import { Effect, Encoding } from "effect"

const program = Effect.gen(function*() {
  const secret = yield* Utf8.encode("whsec_test_secret_key")
  const payload = yield* Utf8.encode("{\"id\":\"evt_1\",\"type\":\"charge.succeeded\",\"amount\":2000}")
  const tampered = yield* Utf8.encode("{\"id\":\"evt_1\",\"type\":\"charge.succeeded\",\"amount\":9999}")

  const authenticator = Hmac.sha256(secret, payload)
  const tamperedAuthenticator = Hmac.sha256(secret, tampered)
  yield* Effect.log("HMAC-SHA256", {
    authenticator: Encoding.encodeBase64Url(authenticator),
    tamperedDiffers: Encoding.encodeHex(authenticator) !== Encoding.encodeHex(tamperedAuthenticator)
  })

  const legacyAuthenticator = Hmac.sha1(secret, payload)
  yield* Effect.log("HMAC-SHA1 protocol compatibility", {
    authenticator: Encoding.encodeHex(legacyAuthenticator)
  })
})

BunRuntime.runMain(program)
