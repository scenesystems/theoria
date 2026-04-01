import { Clock, Effect } from "effect"

import { generateKeyPair, sign, toHex, utf8ToBytes, verify } from "@scenesystems/sign"
import type { Program } from "../../../contracts/presentation.js"
import type { RunData } from "../../../contracts/run.js"

import { executableProgram } from "../program-source.js"

export const preloadProgram: Effect.Effect<Program, unknown, never> = executableProgram(import.meta.url)

const messageText = "Hello from Theoria — digital signature demo"

const measured = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.gen(function*() {
    const startedAt = yield* Clock.currentTimeMillis
    const value = yield* effect
    const endedAt = yield* Clock.currentTimeMillis

    return { value, durationMs: endedAt - startedAt }
  })

export const run: Effect.Effect<RunData, unknown, never> = Effect.gen(function*() {
  const startedAt = yield* Clock.currentTimeMillis
  const message = utf8ToBytes(messageText)

  const ed25519Keys = yield* measured(generateKeyPair("ed25519"))
  const secp256k1Keys = yield* measured(generateKeyPair("secp256k1-ecdsa"))

  const ed25519Sig = yield* sign("ed25519", message, ed25519Keys.value.secretKey, ed25519Keys.value.publicKey)
  const secp256k1Sig = yield* sign(
    "secp256k1-ecdsa",
    message,
    secp256k1Keys.value.secretKey,
    secp256k1Keys.value.publicKey
  )

  const ed25519Valid = yield* verify(ed25519Sig, message)
  const secp256k1Valid = yield* verify(secp256k1Sig, message)

  const tamperedMessage = utf8ToBytes("Tampered message")
  const ed25519Tampered = yield* verify(ed25519Sig, tamperedMessage)

  const runnableProgram = yield* preloadProgram
  const endedAt = yield* Clock.currentTimeMillis

  return {
    id: "sign",
    packageName: "@scenesystems/sign",
    summary: "@scenesystems/sign compared Ed25519 and secp256k1 key generation, signing, and verification.",
    durationMs: endedAt - startedAt,
    program: runnableProgram,
    sections: [
      {
        title: "Key Generation",
        items: [
          {
            _tag: "Comparison",
            label: "Keygen time",
            baseline: secp256k1Keys.durationMs,
            improved: ed25519Keys.durationMs,
            unit: "ms",
            direction: "lower-is-better"
          },
          {
            _tag: "Table",
            label: "Key sizes",
            columns: ["Algorithm", "Public key", "Secret key", "Signature"],
            rows: [
              [
                "ed25519",
                String(ed25519Keys.value.publicKey.length),
                String(ed25519Keys.value.secretKey.length),
                String(ed25519Sig.signature.length)
              ],
              [
                "secp256k1-ecdsa",
                String(secp256k1Keys.value.publicKey.length),
                String(secp256k1Keys.value.secretKey.length),
                String(secp256k1Sig.signature.length)
              ]
            ]
          }
        ]
      },
      {
        title: "Signature",
        items: [
          { _tag: "Text", label: "Message", value: messageText },
          { _tag: "Text", label: "Ed25519 public key", value: toHex(ed25519Keys.value.publicKey) },
          { _tag: "Text", label: "Ed25519 signature", value: toHex(ed25519Sig.signature) }
        ]
      },
      {
        title: "Verification",
        items: [
          { _tag: "Text", label: "Ed25519 valid signature", value: String(ed25519Valid) },
          { _tag: "Text", label: "secp256k1 valid signature", value: String(secp256k1Valid) },
          { _tag: "Text", label: "Ed25519 tampered message", value: String(ed25519Tampered) }
        ]
      },
      {
        title: "Size Comparison",
        items: [
          {
            _tag: "Comparison",
            label: "Public key size",
            baseline: secp256k1Keys.value.publicKey.length,
            improved: ed25519Keys.value.publicKey.length,
            unit: "bytes",
            direction: "lower-is-better"
          },
          {
            _tag: "Comparison",
            label: "Signature size",
            baseline: secp256k1Sig.signature.length,
            improved: ed25519Sig.signature.length,
            unit: "bytes",
            direction: "lower-is-better"
          }
        ]
      }
    ]
  }
})
