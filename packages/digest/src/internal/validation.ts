/**
 * Input validation for digest operations.
 *
 * Guards against values that cannot participate in deterministic
 * canonicalization. Returns Either — left for unsupported values,
 * right for valid values.
 *
 * @internal
 */

import { Either, Match, Predicate } from "effect"
import { FingerprintUnsupportedValue } from "../schemas/errors.js"

const unsupported = (
  valueType: string,
  reason: string
): Either.Either<never, FingerprintUnsupportedValue> =>
  Either.left(new FingerprintUnsupportedValue({ valueType, reason }))

/**
 * Validate a value is safe for JCS canonicalization.
 *
 * @internal
 */
export const validateValue = (
  value: unknown
): Either.Either<unknown, FingerprintUnsupportedValue> =>
  Match.value(value).pipe(
    Match.when(Predicate.isUndefined, () => unsupported("undefined", "undefined is not representable in JSON")),
    Match.when(Predicate.isFunction, () => unsupported("function", "functions are not serializable")),
    Match.when(Predicate.isSymbol, () => unsupported("symbol", "symbols are not serializable")),
    Match.when(Predicate.isBigInt, () => unsupported("bigint", "BigInt must be schema-encoded as string first")),
    Match.when(Predicate.isDate, () => unsupported("Date", "Date must be schema-encoded as ISO string first")),
    Match.when(Predicate.isUint8Array, () =>
      unsupported("Uint8Array", "Uint8Array must be schema-encoded as base64url string first")),
    Match.when(Predicate.isNumber, (n) =>
      Number.isNaN(n)
        ? unsupported("number", "NaN is not deterministic")
        : !Number.isFinite(n)
        ? unsupported("number", "Infinity is not representable in JSON")
        : Either.right(n)),
    Match.orElse((v) =>
      Either.right(v)
    )
  )
