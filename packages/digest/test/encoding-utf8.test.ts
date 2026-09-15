/**
 * Strict UTF-8 encoding contracts.
 *
 * Fixed expectations are hand-authored Unicode byte oracles. Generated cases
 * prove round-trip identity and exact malformed UTF-16 diagnostics.
 */

import { describe, expect, it } from "@effect/vitest"
import { Boolean as B, Effect, Exit, FastCheck as fc, Number as N, String as Str, Tuple } from "effect"

import { canonicalize } from "../src/canonicalize.js"
import { canonicalJsonBytes } from "../src/convenience.js"
import { encodeUtf8, toHex } from "../src/encoding.js"
import { utf8ByteLengthUnchecked } from "../src/internal/unicode.js"
import { InvalidUnicode } from "../src/schemas/errors.js"
import { oracleUtf8 } from "./helpers/bytes.js"

const wellFormedString = fc.fullUnicodeString({ maxLength: 64 })

describe("encodeUtf8", () => {
  it.effect("keeps an astral scalar intact across the canonical byte segment boundary", () =>
    Effect.gen(function*() {
      const value = Str.concat(Str.repeat(N.subtract(N.multiply(32, 1024), 2))("a"), "😀")
      const canonical = yield* canonicalize(value)
      const bytes = yield* canonicalJsonBytes(value)

      expect(bytes).toStrictEqual(yield* oracleUtf8(canonical))
    }))

  it.effect("encodes ASCII BMP and astral text to exact UTF-8 bytes", () =>
    Effect.gen(function*() {
      const encoded = yield* encodeUtf8("Aé€😀")

      expect(toHex(encoded)).toBe("41c3a9e282acf09f9880")
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

      expect(toHex(canonical)).toBe("c3a9")
      expect(toHex(decomposed)).toBe("65cc81")
      expect(canonical).not.toStrictEqual(decomposed)
    }))

  it.effect.prop(
    "encodes every generated well-formed string to the runtime's exact bytes",
    Tuple.make(wellFormedString),
    ([text]) =>
      Effect.gen(function*() {
        const encoded = yield* encodeUtf8(text)
        expect(encoded).toStrictEqual(yield* oracleUtf8(text))
      }),
    { fastCheck: { numRuns: 200 } }
  )

  it.effect.prop(
    "measures every generated well-formed string exactly like the sole UTF-8 encoder",
    Tuple.make(wellFormedString),
    ([text]) =>
      Effect.gen(function*() {
        const encoded = yield* encodeUtf8(text)
        expect(utf8ByteLengthUnchecked(text)).toBe(encoded.byteLength)
      }),
    { fastCheck: { numRuns: 200 } }
  )

  it.effect.prop(
    "rejects every injected unpaired surrogate at the injected index",
    Tuple.make(wellFormedString, wellFormedString, fc.boolean()),
    ([prefix, suffix, injectHigh]) => {
      const surrogate = B.match(injectHigh, { onTrue: () => "\uD800", onFalse: () => "\uDC00" })

      return Effect.gen(function*() {
        const exit = yield* Effect.exit(encodeUtf8(Str.concat(Str.concat(prefix, surrogate), suffix)))

        expect(exit).toStrictEqual(Exit.fail(
          new InvalidUnicode({
            kind: B.match(injectHigh, { onTrue: () => "lone-high-surrogate", onFalse: () => "lone-low-surrogate" }),
            codeUnitIndex: Str.length(prefix)
          })
        ))
      })
    },
    { fastCheck: { numRuns: 200 } }
  )
})
