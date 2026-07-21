/**
 * Strict Unicode validation and UTF-8 encoding.
 *
 * This is the package's only scalar-well-formedness implementation. The Web
 * `TextEncoder` is safe to call only after `unicodeFault` accepts the input.
 *
 * @internal
 */

import { Array as Arr, Option } from "effect"

import { InvalidUnicode } from "../schemas/errors.js"

const HIGH_SURROGATE_START = 0xd800
const HIGH_SURROGATE_END = 0xdbff
const LOW_SURROGATE_START = 0xdc00
const LOW_SURROGATE_END = 0xdfff

const isHighSurrogate = (codeUnit: number): boolean =>
  codeUnit >= HIGH_SURROGATE_START && codeUnit <= HIGH_SURROGATE_END

const isLowSurrogate = (codeUnit: number): boolean => codeUnit >= LOW_SURROGATE_START && codeUnit <= LOW_SURROGATE_END

const isUnpairedSurrogateAt = (text: string, codeUnitIndex: number): boolean => {
  const codeUnit = text.charCodeAt(codeUnitIndex)

  return isHighSurrogate(codeUnit)
    ? !isLowSurrogate(text.charCodeAt(codeUnitIndex + 1))
    : isLowSurrogate(codeUnit) && !isHighSurrogate(text.charCodeAt(codeUnitIndex - 1))
}

/** @internal */
export const unicodeFault = (text: string): Option.Option<InvalidUnicode> => {
  if (Reflect.apply(Reflect.get(String.prototype, "isWellFormed"), text, [])) {
    return Option.none()
  }

  return Arr.findFirst(
    Arr.makeBy(text.length, (codeUnitIndex) => codeUnitIndex),
    (codeUnitIndex) => isUnpairedSurrogateAt(text, codeUnitIndex)
  ).pipe(
    Option.map((codeUnitIndex) =>
      new InvalidUnicode({
        kind: isHighSurrogate(text.charCodeAt(codeUnitIndex))
          ? "lone-high-surrogate"
          : "lone-low-surrogate",
        codeUnitIndex
      })
    )
  )
}

const textEncoder = Reflect.construct<[], object>(Reflect.get(globalThis, "TextEncoder"), [])

/** @internal */
export const encodeUtf8Unchecked = (text: string): Uint8Array =>
  Reflect.apply(Reflect.get(textEncoder, "encode"), textEncoder, [text])
