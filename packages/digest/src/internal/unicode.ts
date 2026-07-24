/**
 * Strict Unicode validation and UTF-8 encoding.
 *
 * This is the package's only scalar-well-formedness implementation. The byte
 * encoder is safe to call only after `unicodeFault` accepts the input.
 *
 * @internal
 */

import { utf8ToBytes } from "@noble/hashes/utils.js"
import { Array as Arr, Iterable, Option } from "effect"

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

/** Inspect one UTF-16 code unit using the package's canonical Unicode law. @internal */
export const unicodeFaultAt = (text: string, codeUnitIndex: number): Option.Option<InvalidUnicode> =>
  isUnpairedSurrogateAt(text, codeUnitIndex)
    ? Option.some(
      new InvalidUnicode({
        kind: isHighSurrogate(text.charCodeAt(codeUnitIndex)) ? "lone-high-surrogate" : "lone-low-surrogate",
        codeUnitIndex
      })
    )
    : Option.none()

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

/** @internal */
export const encodeUtf8Unchecked = (text: string): Uint8Array => utf8ToBytes(text)

/** Measure well-formed text using the package's canonical UTF-8 law. @internal */
export const utf8ByteLengthUnchecked = (text: string): number =>
  Iterable.reduce(text, 0, (length, character) => {
    const codeUnit = character.charCodeAt(0)
    return length + (character.length === 2 ? 4 : codeUnit < 0x80 ? 1 : codeUnit < 0x800 ? 2 : 3)
  })
