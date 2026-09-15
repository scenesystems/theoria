/** Verification entrypoint, never deployed: bundled from an isolated packed installation. */
import { HttpApp, HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { Jwt, rsaPublicKeyFromJwk, rsaSha256Verify } from "@scenesystems/sign"
import { Effect, Match, Redacted, TestClock, TestContext } from "effect"

import { Identity, Request, Result } from "./protocol.js"

const policy = new Jwt.Policy({ issuer: "https://team.example", audience: "app", maxLifetimeSeconds: 86_400 })
const respond = HttpServerResponse.schemaJson(Result)

const app = Effect.gen(function*() {
  const request = yield* HttpServerRequest.schemaBodyJson(Request)
  return yield* Effect.suspend(() =>
    Match.value(request).pipe(
      Match.tag("Ping", () => Effect.succeed(true)),
      Match.tag("Rsa", ({ jwk, signature, message }) =>
        Effect.flatMap(rsaPublicKeyFromJwk(jwk), (key) =>
          rsaSha256Verify(signature, message, key))),
      Match.tag("Jwt", ({ token, jwks, nowMillis }) =>
        TestClock.setTime(nowMillis).pipe(
          Effect.zipRight(Jwt.verifyRs256(Redacted.make(token), jwks, policy, Identity)),
          Effect.provide(TestContext.TestContext)
        )),
      Match.exhaustive
    )
  ).pipe(
    Effect.matchEffect({
      onFailure: (error) => respond(error, { status: 400 }),
      onSuccess: respond
    })
  )
})

export default { fetch: HttpApp.toWebHandler(app) }
