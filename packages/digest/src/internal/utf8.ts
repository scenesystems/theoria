/**
 * Utf8's strict Unicode validation, byte encoding, and byte measurement.
 *
 * This is the package's only scalar-well-formedness implementation. The byte
 * encoder is safe to call only after `unicodeFault` accepts the input.
 *
 * @internal
 */

import { Boolean as B, type Effect, Match, Number as N, Option, Stream, String as Str } from "effect"

import { InvalidUnicode } from "../Utf8.js"

const isHighSurrogate = N.between({ minimum: 0xd800, maximum: 0xdbff })
const isLowSurrogate = N.between({ minimum: 0xdc00, maximum: 0xdfff })

/** Inspect one UTF-16 code unit using the package's canonical Unicode law. @internal */
export const unicodeFaultAt = (text: string, codeUnitIndex: number): Option.Option<InvalidUnicode> =>
  Str.charCodeAt(text, codeUnitIndex).pipe(Option.flatMap((codeUnit) =>
    Match.value(codeUnit).pipe(
      Match.when(isHighSurrogate, () =>
        B.match(Option.exists(Str.charCodeAt(text, N.increment(codeUnitIndex)), isLowSurrogate), {
          onTrue: () =>
            Option.none(),
          onFalse: () => Option.some(new InvalidUnicode({ kind: "lone-high-surrogate", codeUnitIndex }))
        })),
      Match.when(isLowSurrogate, () =>
        B.match(Option.exists(Str.charCodeAt(text, N.decrement(codeUnitIndex)), isHighSurrogate), {
          onTrue: () =>
            Option.none(),
          onFalse: () =>
            Option.some(new InvalidUnicode({ kind: "lone-low-surrogate", codeUnitIndex }))
        })),
      Match.orElse(() =>
        Option.none()
      )
    )
  ))

/** @internal */
export const unicodeFault = (text: string): Option.Option<InvalidUnicode> =>
  // Unicode mode skips valid pairs but still reports UTF-16 indices for lone halves.
  Option.flatMap(Str.search(text, /[\ud800-\udfff]/u), (index) => unicodeFaultAt(text, index))

/** Encode one validated segment through Effect's public text stream codec. @internal */
export const encodeUtf8Unchecked = (text: string): Effect.Effect<Uint8Array> =>
  Stream.make(text).pipe(Stream.encodeText, Stream.mkUint8Array)

/**
 * Measure already validated text: every non-ASCII code unit contributes one
 * extra byte, and every non-surrogate BMP unit above U+07FF contributes another.
 * A valid surrogate pair therefore contributes four bytes, not six.
 * @internal
 */
export const utf8ByteLengthUnchecked = (text: string): number =>
  Option.match(Str.search(text, /[\u0080-\u{10ffff}]/u), {
    onNone: () => Str.length(text),
    onSome: () =>
      N.sum(
        Str.length(text),
        N.sum(
          Str.length(Str.replace(/[^\u0080-\uffff]/g, "")(text)),
          Str.length(Str.replace(/[^\u0800-\ud7ff\ue000-\uffff]/g, "")(text))
        )
      )
  })
