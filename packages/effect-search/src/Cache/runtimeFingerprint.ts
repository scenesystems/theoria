/**
 * Runtime-only fingerprinting for in-memory identity checks.
 *
 * @since 0.1.0
 */
import { blake3Hash, toBase64Url, utf8ToBytes } from "@scenesystems/digest"

import { Array as Arr, Chunk, Effect, Match, Option, Order, Predicate, Record as Rec } from "effect"

import { FingerprintUnsupportedValue } from "./fingerprintError.js"

const RUNTIME_DIGEST_PREFIX = "runtime-blake3-256"
const DIGEST_PATTERN = /^[A-Za-z0-9_-]{43}$/

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

const int8AsUint8 = (input: Int8Array): Uint8Array => new Uint8Array(input.buffer, input.byteOffset, input.byteLength)

const bytesHex = (bytes: Uint8Array): string =>
  Arr.reduce(Arr.fromIterable(bytes), "", (hex, byte) => `${hex}${byte.toString(16).padStart(2, "0")}`)

const isNegativeZero = (value: number): boolean => value === 0 && 1 / value < 0

const numberToken = (value: number): string =>
  Match.value(Number.isNaN(value)).pipe(
    Match.when(true, () => "num:nan"),
    Match.orElse(() =>
      Match.value(Number.isFinite(value)).pipe(
        Match.when(true, () =>
          Match.value(isNegativeZero(value)).pipe(
            Match.when(true, () => "num:-0"),
            Match.orElse(() => `num:${value}`)
          )),
        Match.orElse(() =>
          Match.value(value > 0).pipe(
            Match.when(true, () => "num:+inf"),
            Match.orElse(() => "num:-inf")
          )
        )
      )
    )
  )

const taggedIdentityTokens = (value: Readonly<Record<string, unknown>>): Chunk.Chunk<string> =>
  Option.fromNullable(value["_tag"]).pipe(
    Option.match({
      onNone: () => Chunk.empty(),
      onSome: (tag) =>
        Match.value(tag).pipe(
          Match.when(Match.string, (resolvedTag) => Chunk.of(`variant:${resolvedTag}`)),
          Match.orElse(() => Chunk.empty())
        )
    })
  )

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

const arrayTokens = (values: ReadonlyArray<unknown>): Effect.Effect<Chunk.Chunk<string>, FingerprintUnsupportedValue> =>
  Effect.forEach(values, canonicalTokens).pipe(
    Effect.map((memberTokens) =>
      Arr.reduce(
        memberTokens,
        Chunk.of(`arr:${values.length}:start`),
        (tokens, entryTokens) => Chunk.appendAll(tokens, entryTokens)
      )
    ),
    Effect.map((tokens) => Chunk.append(tokens, `arr:${values.length}:end`))
  )

const structTokens = (
  record: Readonly<Record<string, unknown>>
): Effect.Effect<Chunk.Chunk<string>, FingerprintUnsupportedValue> => {
  const sortedKeys = Arr.sort(Rec.keys(record), Order.string)
  const withIdentity = Chunk.appendAll(
    Chunk.of(`obj:${sortedKeys.length}:start`),
    taggedIdentityTokens(record)
  )

  return Effect.forEach(
    sortedKeys,
    (key) =>
      canonicalTokens(record[key]).pipe(
        Effect.map((valueTokens) =>
          Chunk.appendAll(
            Chunk.of(`key:${key}`),
            valueTokens
          )
        )
      )
  ).pipe(
    Effect.map((fields) =>
      Arr.reduce(
        fields,
        withIdentity,
        (tokens, fieldTokens) => Chunk.appendAll(tokens, fieldTokens)
      )
    ),
    Effect.map((tokens) => Chunk.append(tokens, `obj:${sortedKeys.length}:end`))
  )
}

const canonicalTokens = (value: unknown): Effect.Effect<Chunk.Chunk<string>, FingerprintUnsupportedValue> =>
  Match.value(value).pipe(
    Match.when(Predicate.isUndefined, () => Effect.succeed(Chunk.of("undefined"))),
    Match.when((input: unknown): input is null => input === null, () => Effect.succeed(Chunk.of("null"))),
    Match.when(Match.boolean, (boolean) => Effect.succeed(Chunk.of(`bool:${boolean ? 1 : 0}`))),
    Match.when(Match.number, (number) => Effect.succeed(Chunk.of(numberToken(number)))),
    Match.when(Match.string, (text) => Effect.succeed(Chunk.of(`str:${text}`))),
    Match.when(Match.bigint, (entry) => Effect.succeed(Chunk.of(`bigint:${entry.toString()}`))),
    Match.when(
      isDate,
      (date) => Effect.succeed(Chunk.of(`date:${Number.isNaN(date.getTime()) ? "invalid" : date.toISOString()}`))
    ),
    Match.when(isUint8Array, (bytes) => Effect.succeed(Chunk.of(`bytes:uint8:${bytes.length}:${bytesHex(bytes)}`))),
    Match.when(isInt8Array, (bytes) => {
      const asUint8 = int8AsUint8(bytes)

      return Effect.succeed(Chunk.of(`bytes:int8:${asUint8.length}:${bytesHex(asUint8)}`))
    }),
    Match.when((candidate: unknown): candidate is ReadonlyArray<unknown> => Arr.isArray(candidate), arrayTokens),
    Match.when(isStruct, structTokens),
    Match.when(
      Match.symbol,
      (symbol) => unsupportedValue("symbol", `unsupported symbol key: ${String(symbol.description)}`)
    ),
    Match.when(
      Predicate.isFunction,
      () => unsupportedValue("function", "functions are not supported for runtime fingerprints")
    ),
    Match.orElse((unknownValue) =>
      unsupportedValue(
        typeof unknownValue,
        `unsupported key value for runtime fingerprint: ${String(unknownValue)}`
      )
    )
  )

const tokenPayload = (tokens: Chunk.Chunk<string>): string =>
  Chunk.reduce(tokens, "", (payload, token) => `${payload}${token.length}:${token};`)

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

const digestTokens = (tokens: Chunk.Chunk<string>): Effect.Effect<string, FingerprintUnsupportedValue> =>
  digestPayload(tokenPayload(tokens))

/**
 * Deterministic runtime fingerprint string for unknown values.
 *
 * Runtime fingerprints are stable for in-memory identity checks but are not
 * the durable cache-key authority.
 *
 * @since 0.1.0
 * @category utils
 */
export const runtimeFingerprint = (value: unknown): Effect.Effect<string, FingerprintUnsupportedValue> =>
  canonicalTokens(value).pipe(
    Effect.flatMap(digestTokens),
    Effect.map((digest) => `${RUNTIME_DIGEST_PREFIX}:${digest}`)
  )
