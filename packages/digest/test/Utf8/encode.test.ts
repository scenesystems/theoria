/**
 * Strict UTF-8 encoding contracts.
 *
 * Fixed expectations are hand-authored Unicode byte oracles. Generated cases
 * prove round-trip identity and exact malformed UTF-16 diagnostics.
 */

import { describe, expect, it } from "@effect/vitest"
import { Boolean as B, Effect, Either, Encoding, FastCheck as fc, String as Str, Tuple } from "effect"

import * as Utf8 from "@scenesystems/digest/Utf8"
import { oracleUtf8 } from "../helpers/bytes.js"

const wellFormedString = fc.fullUnicodeString({ maxLength: 64 })

describe("Utf8.encode", () => {
  it.effect("encodes ASCII BMP and astral text to exact UTF-8 bytes", () =>
    Effect.gen(function*() {
      const encoded = yield* Utf8.encode("Aé€😀")

      expect(Encoding.encodeHex(encoded)).toBe("41c3a9e282acf09f9880")
    }))

  it.effect("rejects a lone high surrogate at its code-unit index", () =>
    Effect.gen(function*() {
      expect(Utf8.encode("ok\uD800")).toStrictEqual(Either.left(
        new Utf8.InvalidUnicode({
          kind: "lone-high-surrogate",
          codeUnitIndex: 2
        })
      ))
    }))

  it.effect("rejects a lone low surrogate at its code-unit index", () =>
    Effect.gen(function*() {
      expect(Utf8.encode("a\uDC00")).toStrictEqual(Either.left(
        new Utf8.InvalidUnicode({
          kind: "lone-low-surrogate",
          codeUnitIndex: 1
        })
      ))
    }))

  it.effect("rejects a mismatched pair at the high surrogate", () =>
    Effect.gen(function*() {
      expect(Utf8.encode("x\uD800\uD801y")).toStrictEqual(Either.left(
        new Utf8.InvalidUnicode({
          kind: "lone-high-surrogate",
          codeUnitIndex: 1
        })
      ))
    }))

  it.effect("preserves canonical and decomposed strings without normalization", () =>
    Effect.gen(function*() {
      const canonical = yield* Utf8.encode("é")
      const decomposed = yield* Utf8.encode("e\u0301")

      expect(Encoding.encodeHex(canonical)).toBe("c3a9")
      expect(Encoding.encodeHex(decomposed)).toBe("65cc81")
      expect(canonical).not.toStrictEqual(decomposed)
    }))

  it.effect.prop(
    "encodes every generated well-formed string to the runtime's exact bytes",
    Tuple.make(wellFormedString),
    ([text]) =>
      Effect.gen(function*() {
        const encoded = yield* Utf8.encode(text)
        expect(encoded).toStrictEqual(yield* oracleUtf8(text))
      }),
    { fastCheck: { numRuns: 200, seed: 3629 } }
  )

  it.effect.prop(
    "rejects every injected unpaired surrogate at the injected index",
    Tuple.make(wellFormedString, wellFormedString, fc.boolean()),
    ([prefix, suffix, injectHigh]) => {
      const surrogate = B.match(injectHigh, { onTrue: () => "\uD800", onFalse: () => "\uDC00" })

      return Effect.gen(function*() {
        expect(Utf8.encode(Str.concat(Str.concat(prefix, surrogate), suffix))).toStrictEqual(Either.left(
          new Utf8.InvalidUnicode({
            kind: B.match(injectHigh, { onTrue: () => "lone-high-surrogate", onFalse: () => "lone-low-surrogate" }),
            codeUnitIndex: Str.length(prefix)
          })
        ))
      })
    },
    { fastCheck: { numRuns: 200, seed: 3629 } }
  )
})
