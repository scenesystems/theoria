/**
 * Webhook Verification — HMAC signatures with @scenesystems/digest.
 *
 * What this shows: a realistic webhook verification flow. Compute HMAC-SHA256
 * (Stripe-style) and HMAC-SHA1 (Shopify-style) signatures over a payload, then
 * confirm that recomputing over the same bytes produces an identical signature
 * while tampered payloads produce a different one.
 *
 * Run: bun run examples/02-webhook-verification.ts
 */

import { BunRuntime } from "@effect/platform-bun"
import { hmacSha1Hex, hmacSha256Base64Url, utf8ToBytes } from "@scenesystems/digest"
import { Effect } from "effect"

const program = Effect.gen(function*() {
  const stripeSecret = utf8ToBytes("whsec_stripe_test_secret_key")
  const stripePayload = utf8ToBytes("{\"id\":\"evt_1\",\"type\":\"charge.succeeded\",\"amount\":2000}")

  const stripeSignature = yield* hmacSha256Base64Url(stripeSecret, stripePayload)
  const recomputed = yield* hmacSha256Base64Url(stripeSecret, stripePayload)
  yield* Effect.log("Stripe HMAC-SHA256", { signature: stripeSignature, verified: stripeSignature === recomputed })

  const tampered = utf8ToBytes("{\"id\":\"evt_1\",\"type\":\"charge.succeeded\",\"amount\":9999}")
  const tamperedSig = yield* hmacSha256Base64Url(stripeSecret, tampered)
  yield* Effect.log("Tampered payload", { rejected: stripeSignature !== tamperedSig })

  const shopifySecret = utf8ToBytes("shopify_webhook_secret")
  const shopifyPayload = utf8ToBytes("{\"order_id\":12345,\"total\":\"49.99\"}")

  const shopifySignature = yield* hmacSha1Hex(shopifySecret, shopifyPayload)
  const shopifyRecomputed = yield* hmacSha1Hex(shopifySecret, shopifyPayload)
  yield* Effect.log("Shopify HMAC-SHA1", {
    signature: shopifySignature,
    verified: shopifySignature === shopifyRecomputed
  })
})

BunRuntime.runMain(program)
