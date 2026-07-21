/**
 * Strict UTF-8 encoding contracts.
 *
 * Fixed expectations are hand-authored Unicode byte oracles. Generated cases
 * prove round-trip identity and exact malformed UTF-16 diagnostics.
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit, FastCheck as fc } from "effect"

import { encodeUtf8 } from "../src/encoding.js"
import { InvalidUnicode } from "../src/schemas/errors.js"

const wellFormedString = fc.fullUnicodeString({ maxLength: 64 })
const utf8Decoder = new TextDecoder("utf-8", { fatal: true })

describe("encodeUtf8", () => {
  it.effect("encodes ASCII BMP and astral text to exact UTF-8 bytes", () =>
    Effect.gen(function*() {
      const encoded = yield* encodeUtf8("Aé€😀")

      expect(encoded).toStrictEqual(Uint8Array.from([
        0x41,
        0xc3,
        0xa9,
        0xe2,
        0x82,
        0xac,
        0xf0,
        0x9f,
        0x98,
        0x80
      ]))
    }))

  it.effect("rejects a lone high surrogate at its code-unit index", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(encodeUtf8("ok\uD800"))

      expect(exit).toStrictEqual(Exit.fail(
        new InvalidUnicode({
          kind: "lone-high-surrogate",
          codeUnitIndex: 2
        })
      ))
    }))

  it.effect("rejects a lone low surrogate at its code-unit index", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(encodeUtf8("a\uDC00"))

      expect(exit).toStrictEqual(Exit.fail(
        new InvalidUnicode({
          kind: "lone-low-surrogate",
          codeUnitIndex: 1
        })
      ))
    }))

  it.effect("rejects a mismatched pair at the high surrogate", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(encodeUtf8("x\uD800\uD801y"))

      expect(exit).toStrictEqual(Exit.fail(
        new InvalidUnicode({
          kind: "lone-high-surrogate",
          codeUnitIndex: 1
        })
      ))
    }))

  it.effect("preserves canonical and decomposed strings without normalization", () =>
    Effect.gen(function*() {
      const canonical = yield* encodeUtf8("é")
      const decomposed = yield* encodeUtf8("e\u0301")

      expect(canonical).toStrictEqual(Uint8Array.from([0xc3, 0xa9]))
      expect(decomposed).toStrictEqual(Uint8Array.from([0x65, 0xcc, 0x81]))
      expect(canonical).not.toStrictEqual(decomposed)
    }))

  it.effect.prop(
    "round-trips every generated well-formed string",
    [wellFormedString],
    ([text]) =>
      Effect.gen(function*() {
        const encoded = yield* encodeUtf8(text)
        expect(utf8Decoder.decode(encoded)).toBe(text)
      }),
    { fastCheck: { numRuns: 200 } }
  )

  it.effect.prop(
    "rejects every injected unpaired surrogate at the injected index",
    [wellFormedString, wellFormedString, fc.boolean()],
    ([prefix, suffix, injectHigh]) => {
      const surrogate = injectHigh ? "\uD800" : "\uDC00"
      const kind = injectHigh ? "lone-high-surrogate" : "lone-low-surrogate"

      return Effect.gen(function*() {
        const exit = yield* Effect.exit(encodeUtf8(`${prefix}${surrogate}${suffix}`))

        expect(exit).toStrictEqual(Exit.fail(
          new InvalidUnicode({
            kind,
            codeUnitIndex: prefix.length
          })
        ))
      })
    },
    { fastCheck: { numRuns: 200 } }
  )
})
