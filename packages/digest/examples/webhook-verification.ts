/**
 * Webhook Verification — HMAC signatures with @scenesystems/digest.
 *
 * Demonstrates:
 * - `hmacSha256Base64Url` for modern webhook verification (Stripe-style)
 * - `hmacSha1Hex` for legacy webhook verification (Shopify-style)
 * - A realistic scenario: receive a payload, compute expected signature, compare
 * - `utf8ToBytes` conversion for string keys and messages
 *
 * Run: bun run examples/webhook-verification.ts
 *
 * @since 0.1.0
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
