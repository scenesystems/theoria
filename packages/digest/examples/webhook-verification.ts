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
 */

import { hmacSha1Hex, hmacSha256Base64Url, utf8ToBytes } from "@scenesystems/digest"
import { Effect } from "effect"

const program = Effect.gen(function*() {
  // --- Stripe-style: HMAC-SHA256 + base64url ---
  const stripeSecret = utf8ToBytes("whsec_stripe_test_secret_key")
  const stripePayload = utf8ToBytes('{"id":"evt_1","type":"charge.succeeded","amount":2000}')

  const stripeSignature = yield* hmacSha256Base64Url(stripeSecret, stripePayload)
  console.log("Stripe signature:", stripeSignature)

  // Simulate verification: recompute and compare
  const recomputed = yield* hmacSha256Base64Url(stripeSecret, stripePayload)
  const stripeValid = stripeSignature === recomputed
  console.log("Stripe verified: ", stripeValid ? "✓ valid" : "✗ invalid")

  // Tampered payload produces a different signature
  const tampered = utf8ToBytes('{"id":"evt_1","type":"charge.succeeded","amount":9999}')
  const tamperedSig = yield* hmacSha256Base64Url(stripeSecret, tampered)
  const tamperedValid = stripeSignature === tamperedSig
  console.log("Tampered payload:", tamperedValid ? "✗ should not match" : "✓ correctly rejected")

  // --- Shopify-style: HMAC-SHA1 + hex (legacy) ---
  const shopifySecret = utf8ToBytes("shopify_webhook_secret")
  const shopifyPayload = utf8ToBytes('{"order_id":12345,"total":"49.99"}')

  const shopifySignature = yield* hmacSha1Hex(shopifySecret, shopifyPayload)
  console.log("Shopify signature:", shopifySignature)

  // Verify the legacy signature
  const shopifyRecomputed = yield* hmacSha1Hex(shopifySecret, shopifyPayload)
  const shopifyValid = shopifySignature === shopifyRecomputed
  console.log("Shopify verified: ", shopifyValid ? "✓ valid" : "✗ invalid")
})

Effect.runPromise(program)
