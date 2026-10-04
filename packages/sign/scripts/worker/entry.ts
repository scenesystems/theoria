/** Verification entrypoint, never deployed: bundled from an isolated packed installation. */
import { Jwt } from "@scenesystems/sign"
import * as Rsa from "@scenesystems/sign/Rsa"
import { Effect, Match, Redacted } from "effect"
import { HttpEffect, HttpServerRequest, HttpServerResponse } from "effect/http"
import * as TestClock from "effect/testing/TestClock"

import { Identity, Request, Result } from "./protocol.js"

const policy = new Jwt.Policy({ issuer: "https://team.example", audience: "app", maxLifetimeSeconds: 86_400 })
const respond = HttpServerResponse.schemaJson(Result)

const app = Effect.gen(function*() {
  const request = yield* HttpServerRequest.schemaBodyJson(Request)
  return yield* Match.value(request).pipe(
    Match.tag("Ping", () => Effect.succeed(true)),
    Match.tag(
      "Rsa",
      ({ jwk, signature, message }) =>
        Effect.flatMap(Rsa.publicKeyFromJwk(jwk), (key) => Rsa.verify(signature, message, key))
    ),
    Match.tag("Jwt", ({ token, jwks, nowMillis }) =>
      TestClock.setTime(nowMillis).pipe(
        Effect.andThen(Jwt.verifyRs256(Redacted.make(token), jwks, policy, Identity)),
        Effect.provide(TestClock.layer())
      )),
    Match.exhaustive,
    Effect.matchEffect({
      onFailure: (error) => respond(error, { status: 400 }),
      onSuccess: respond
    })
  )
})

export default { fetch: HttpEffect.toWebHandler(app) }
