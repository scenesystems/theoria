/**
 * Durable cache-key fingerprinting using BLAKE3-256 base64url digests.
 *
 * @since 0.1.0
 */
import { blake3Hash, toBase64Url, utf8ToBytes } from "@scenesystems/digest"

import { Array as Arr, Effect, Match, Order, Predicate, Record as Rec, Schema } from "effect"

import { FingerprintUnsupportedValue } from "./fingerprintError.js"

const DURABLE_DIGEST_PREFIX = "blake3-256"
const DIGEST_PATTERN = /^[A-Za-z0-9_-]{43}$/

const encodeUnknownJson = Schema.encodeSync(Schema.parseJson(Schema.Unknown))

const isStruct = (input: unknown): input is Readonly<Record<string, unknown>> => {
  if (typeof input !== "object" || input === null || Arr.isArray(input)) {
    return false
  }

  const prototype = Object.getPrototypeOf(input)

  return prototype === Object.prototype || prototype === null
}

const isDate = (input: unknown): input is Date => input instanceof Date

const isUint8Array = (input: unknown): input is Uint8Array => input instanceof Uint8Array

const isInt8Array = (input: unknown): input is Int8Array => input instanceof Int8Array

const isNegativeZero = (value: number): boolean => value === 0 && 1 / value < 0

const commaJoined = (entries: ReadonlyArray<string>): string =>
  Arr.reduce(entries, "", (joined, entry) => joined.length === 0 ? entry : `${joined},${entry}`)

const unsupportedValue = (
  valueType: string,
  reason: string
): Effect.Effect<never, FingerprintUnsupportedValue> =>
  Effect.fail(
    new FingerprintUnsupportedValue({
      valueType,
      reason
    })
  )

const digestPayload = (payload: string): Effect.Effect<string, FingerprintUnsupportedValue> =>
  Effect.try({
    try: () => utf8ToBytes(payload),
    catch: (cause) =>
      new FingerprintUnsupportedValue({
        valueType: "digest",
        reason: String(cause)
      })
  }).pipe(
    Effect.flatMap(blake3Hash),
    Effect.flatMap(toBase64Url),
    Effect.mapError((cause) =>
      new FingerprintUnsupportedValue({
        valueType: "digest",
        reason: String(cause)
      })
    ),
    Effect.flatMap((digest) =>
      Match.value(DIGEST_PATTERN.test(digest)).pipe(
        Match.when(true, () => Effect.succeed(digest)),
        Match.orElse(() => unsupportedValue("digest", `invalid base64url digest shape: ${digest}`))
      )
    )
  )

const jsonPrimitive = (value: string | number | boolean | null): Effect.Effect<string, FingerprintUnsupportedValue> =>
  Effect.try({
    try: () => encodeUnknownJson(value),
    catch: (cause) =>
      new FingerprintUnsupportedValue({
        valueType: typeof value,
        reason: `json encoding failure: ${String(cause)}`
      })
  })

const durableCanonicalJson = (value: unknown): Effect.Effect<string, FingerprintUnsupportedValue> =>
  Match.value(value).pipe(
    Match.when(
      Predicate.isUndefined,
      () => unsupportedValue("undefined", "durable cache fingerprints require JSON values and cannot encode undefined")
    ),
    Match.when((input: unknown): input is null => input === null, () => jsonPrimitive(null)),
    Match.when(Match.boolean, (entry) => jsonPrimitive(entry)),
    Match.when(
      Match.number,
      (entry) =>
        Match.value(Number.isFinite(entry) && !isNegativeZero(entry)).pipe(
          Match.when(true, () => jsonPrimitive(entry)),
          Match.orElse(() =>
            unsupportedValue("number", "durable cache fingerprints require finite numbers and disallow -0")
          )
        )
    ),
    Match.when(Match.string, (entry) => jsonPrimitive(entry)),
    Match.when(
      Match.bigint,
      () =>
        unsupportedValue("bigint", "durable cache fingerprints require bigint values to be schema-encoded as strings")
    ),
    Match.when(
      isDate,
      () =>
        unsupportedValue("Date", "durable cache fingerprints require Date values to be schema-encoded as ISO strings")
    ),
    Match.when(
      isUint8Array,
      () =>
        unsupportedValue(
          "Uint8Array",
          "durable cache fingerprints require byte values to be schema-encoded as base64url strings"
        )
    ),
    Match.when(
      isInt8Array,
      () =>
        unsupportedValue(
          "Int8Array",
          "durable cache fingerprints require byte values to be schema-encoded as base64url strings"
        )
    ),
    Match.when(
      (candidate: unknown): candidate is ReadonlyArray<unknown> => Arr.isArray(candidate),
      (values) =>
        Effect.forEach(values, durableCanonicalJson).pipe(
          Effect.map((encodedEntries) => `[${commaJoined(encodedEntries)}]`)
        )
    ),
    Match.when(isStruct, (record) =>
      Effect.forEach(
        Arr.sort(Rec.keys(record), Order.string),
        (key) =>
          durableCanonicalJson(record[key]).pipe(
            Effect.flatMap((encodedValue) =>
              jsonPrimitive(key).pipe(
                Effect.map((encodedKey) => `${encodedKey}:${encodedValue}`)
              )
            )
          )
      ).pipe(
        Effect.map((encodedFields) => `{${commaJoined(encodedFields)}}`)
      )),
    Match.when(
      Match.symbol,
      () => unsupportedValue("symbol", "durable cache fingerprints cannot encode symbols")
    ),
    Match.when(
      Predicate.isFunction,
      () => unsupportedValue("function", "durable cache fingerprints cannot encode functions")
    ),
    Match.orElse((unknownValue) =>
      unsupportedValue(
        typeof unknownValue,
        `unsupported key value for durable cache fingerprint: ${String(unknownValue)}`
      )
    )
  )

/**
 * Deterministic, durable fingerprint string for cache key identity.
 *
 * The preimage must already be schema-encoded into a portable JSON shape.
 *
 * @since 0.1.0
 * @category utils
 */
export const durableFingerprint = (value: unknown): Effect.Effect<string, FingerprintUnsupportedValue> =>
  durableCanonicalJson(value).pipe(
    Effect.flatMap(digestPayload),
    Effect.map((digest) => `${DURABLE_DIGEST_PREFIX}:${digest}`)
  )
