/**
 * RFC 8785 JCS implementation internals.
 *
 * Recursive canonical JSON serializer. Object keys sorted by
 * UTF-16 code unit order, ES2015 number serialization, nested
 * object/array recursion.
 *
 * @internal
 */

import { Array as Arr, Either, Option, Order, Predicate, Record, Tuple } from "effect"
import type { FingerprintUnsupportedValue } from "../schemas/errors.js"
import { validateValue } from "./validation.js"

const escapeJsonString = (s: string): string => {
  const escaped = Arr.fromIterable(s).map((ch) => {
    const code = ch.charCodeAt(0)
    if (ch === "\"") return "\\\""
    if (ch === "\\") return "\\\\"
    if (code < 0x20) {
      if (ch === "\n") return "\\n"
      if (ch === "\r") return "\\r"
      if (ch === "\t") return "\\t"
      if (ch === "\b") return "\\b"
      if (ch === "\f") return "\\f"
      return `\\u${code.toString(16).padStart(4, "0")}`
    }
    return ch
  })
  return `"${escaped.join("")}"`
}

const serializeNumber = (n: number): string => Object.is(n, -0) ? "0" : String(n)

const serializeArray = (
  values: ReadonlyArray<unknown>
): Either.Either<string, FingerprintUnsupportedValue> => {
  const results = Arr.map(values, canonicalizeValue)
  const firstError = Arr.findFirst(results, Either.isLeft)
  return Option.match(firstError, {
    onNone: () =>
      Either.right(
        `[${Arr.map(results, (r) => Either.getOrElse(r, () => "")).join(",")}]`
      ),
    onSome: (err) => err
  })
}

const entryKeyOrder = Order.mapInput(Order.string, (entry: readonly [string, unknown]) => Tuple.getFirst(entry))

const serializeObject = (
  obj: { readonly [x: string]: unknown }
): Either.Either<string, FingerprintUnsupportedValue> => {
  const entries = Record.toEntries(obj)
  const sorted = Arr.sort(entries, entryKeyOrder)
  const entryResults = Arr.map(sorted, (entry) =>
    Either.map(
      canonicalizeValue(Tuple.getSecond(entry)),
      (serialized) => `${escapeJsonString(Tuple.getFirst(entry))}:${serialized}`
    ))
  const firstError = Arr.findFirst(entryResults, Either.isLeft)
  return Option.match(firstError, {
    onNone: () =>
      Either.right(
        `{${Arr.map(entryResults, (r) => Either.getOrElse(r, () => "")).join(",")}}`
      ),
    onSome: (err) => err
  })
}

/**
 * Recursively serialize a value to RFC 8785 canonical JSON.
 *
 * @internal
 */
export const canonicalizeValue = (
  value: unknown
): Either.Either<string, FingerprintUnsupportedValue> => {
  const validated = validateValue(value)
  if (Either.isLeft(validated)) return Either.left(validated.left)

  if (Predicate.isNull(value)) return Either.right("null")
  if (Predicate.isString(value)) return Either.right(escapeJsonString(value))
  if (Predicate.isBoolean(value)) return Either.right(value ? "true" : "false")
  if (Predicate.isNumber(value)) return Either.right(serializeNumber(value))
  if (Arr.isArray(value)) return serializeArray(value)
  if (Predicate.isRecord(value)) return serializeObject(value)

  return Either.right(String(value))
}
