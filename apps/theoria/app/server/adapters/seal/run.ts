import type { FileSystem, Path } from "@effect/platform"
import { Clock, Effect } from "effect"

import { equalBytes, generateKey, seal, unseal, utf8FromBytes, utf8ToBytes } from "@scenesystems/seal"
import { sealEntryDescriptor } from "../../../contracts/entry/descriptors/seal.js"
import { EntryRunIdentity } from "../../../contracts/entry/routing.js"
import type { RunData } from "../../../contracts/study/run.js"

import type { Program } from "../../../contracts/presentation/program.js"

import { executableProgram, type ProgramSourceReadError } from "../../kernel/program-source.js"

export const preloadProgram: Effect.Effect<
  Program,
  ProgramSourceReadError,
  FileSystem.FileSystem | Path.Path
> = executableProgram(import.meta.url)

const plaintextString = "Authenticated encryption round-trip study from Theoria"
const sealRunIdentity = EntryRunIdentity.project(sealEntryDescriptor)

const measured = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.gen(function*() {
    const startedAt = yield* Clock.currentTimeMillis
    const value = yield* effect
    const endedAt = yield* Clock.currentTimeMillis

    return { value, durationMs: endedAt - startedAt }
  })

export const run: Effect.Effect<RunData, unknown, FileSystem.FileSystem | Path.Path> = Effect.gen(function*() {
  const startedAt = yield* Clock.currentTimeMillis
  const plaintext = utf8ToBytes(plaintextString)
  const key = yield* generateKey()

  const xchacha = yield* measured(seal("xchacha20-poly1305", key, plaintext))
  const gcmsiv = yield* measured(seal("aes-256-gcm-siv", key, plaintext))
  const gcm = yield* measured(seal("aes-256-gcm", key, plaintext))

  const xchachaRecovered = yield* unseal(key, xchacha.value)
  const gcmsivRecovered = yield* unseal(key, gcmsiv.value)
  const gcmRecovered = yield* unseal(key, gcm.value)

  const xchachaMatch = equalBytes(plaintext, xchachaRecovered)
  const gcmsivMatch = equalBytes(plaintext, gcmsivRecovered)
  const gcmMatch = equalBytes(plaintext, gcmRecovered)

  const xchacha2 = yield* seal("xchacha20-poly1305", key, plaintext)
  const noncesDistinct = xchacha.value.nonce !== xchacha2.nonce

  const runnableProgram = yield* preloadProgram
  const endedAt = yield* Clock.currentTimeMillis

  return {
    ...sealRunIdentity,
    summary:
      "@scenesystems/seal compared XChaCha20-Poly1305, AES-256-GCM-SIV, and AES-256-GCM with round-trip verification.",
    durationMs: endedAt - startedAt,
    program: runnableProgram,
    sections: [
      {
        title: "Algorithm Comparison",
        items: [
          {
            _tag: "Table",
            label: "Encryption results",
            columns: ["Algorithm", "Nonce length", "Ciphertext length", "Round-trip"],
            rows: [
              [
                "xchacha20-poly1305",
                String(xchacha.value.nonce.length),
                String(xchacha.value.ciphertext.length),
                String(xchachaMatch)
              ],
              [
                "aes-256-gcm-siv",
                String(gcmsiv.value.nonce.length),
                String(gcmsiv.value.ciphertext.length),
                String(gcmsivMatch)
              ],
              [
                "aes-256-gcm",
                String(gcm.value.nonce.length),
                String(gcm.value.ciphertext.length),
                String(gcmMatch)
              ]
            ]
          }
        ]
      },
      {
        title: "Encryption Timing",
        items: [
          { _tag: "Scalar", label: "XChaCha20-Poly1305", value: xchacha.durationMs, unit: "ms", format: "fixed" },
          { _tag: "Scalar", label: "AES-256-GCM-SIV", value: gcmsiv.durationMs, unit: "ms", format: "fixed" },
          { _tag: "Scalar", label: "AES-256-GCM", value: gcm.durationMs, unit: "ms", format: "fixed" }
        ]
      },
      {
        title: "Envelope Structure",
        items: [
          { _tag: "Text", label: "Algorithm tag", value: xchacha.value.algorithm },
          { _tag: "Scalar", label: "Key size", value: key.length, unit: "bytes", format: "integer" },
          { _tag: "Scalar", label: "Plaintext size", value: plaintext.length, unit: "bytes", format: "integer" },
          { _tag: "Text", label: "Nonce (base64url)", value: xchacha.value.nonce },
          { _tag: "Text", label: "Ciphertext (base64url)", value: xchacha.value.ciphertext }
        ]
      },
      {
        title: "Decryption",
        items: [
          { _tag: "Text", label: "Recovered plaintext", value: utf8FromBytes(xchachaRecovered) },
          { _tag: "Text", label: "Constant-time byte match", value: String(xchachaMatch) }
        ]
      },
      {
        title: "Nonce Uniqueness",
        items: [
          { _tag: "Text", label: "Nonce A", value: xchacha.value.nonce },
          { _tag: "Text", label: "Nonce B (same plaintext, same key)", value: xchacha2.nonce },
          { _tag: "Text", label: "Nonces distinct", value: String(noncesDistinct) }
        ]
      }
    ]
  }
})
