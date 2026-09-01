/**
 * Runtime-only fingerprinting for in-memory identity checks.
 *
 * @since 0.1.0
 */
import { blake3Hash, encodeUtf8, toBase64Url } from "@scenesystems/digest"
import type { InvalidUnicode } from "@scenesystems/digest"

import { Array as Arr, Chunk, Effect, Match, Option, Order, Predicate, Record as Rec, Schema } from "effect"

const RUNTIME_DIGEST_PREFIX = "runtime-blake3-256"

/**
 * Closed rejection reasons for values outside runtime fingerprint identity.
 *
 * @since 0.3.0
 * @category errors
 */
export class RuntimeFingerprintError extends Schema.TaggedError<RuntimeFingerprintError>()(
  "effect-search/RuntimeFingerprintError",
  {
    reason: Schema.Literal("function", "symbol", "unsupported-value")
  }
) {}

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

const unsupportedValue = (reason: RuntimeFingerprintError["reason"]): Effect.Effect<never, RuntimeFingerprintError> =>
  Effect.fail(new RuntimeFingerprintError({ reason }))

const arrayTokens = (values: ReadonlyArray<unknown>): Effect.Effect<Chunk.Chunk<string>, RuntimeFingerprintError> =>
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
): Effect.Effect<Chunk.Chunk<string>, RuntimeFingerprintError> => {
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

const canonicalTokens = (value: unknown): Effect.Effect<Chunk.Chunk<string>, RuntimeFingerprintError> =>
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
    Match.when(Match.symbol, () => unsupportedValue("symbol")),
    Match.when(Predicate.isFunction, () => unsupportedValue("function")),
    Match.orElse(() => unsupportedValue("unsupported-value"))
  )

const tokenPayload = (tokens: Chunk.Chunk<string>): string =>
  Chunk.reduce(tokens, "", (payload, token) => `${payload}${token.length}:${token};`)

const digestPayload = (payload: string): Effect.Effect<string, InvalidUnicode> =>
  Effect.gen(function*() {
    const bytes = yield* encodeUtf8(payload)
    const hash = yield* blake3Hash(bytes)
    return toBase64Url(hash)
  })

const digestTokens = (tokens: Chunk.Chunk<string>): Effect.Effect<string, InvalidUnicode> =>
  digestPayload(tokenPayload(tokens))

/**
 * Deterministic runtime fingerprint string for unknown values.
 *
 * @remarks
 * Runtime fingerprints are stable for in-memory identity checks but are not
 * the durable cache-key authority. Malformed text exposes digest's
 * `InvalidUnicode`; its code-unit index is relative to the internal canonical
 * token payload rather than the original runtime value.
 *
 * @since 0.1.0
 * @category fingerprint
 */
export const runtimeFingerprint = (
  value: unknown
): Effect.Effect<string, InvalidUnicode | RuntimeFingerprintError> =>
  canonicalTokens(value).pipe(
    Effect.flatMap(digestTokens),
    Effect.map((digest) => `${RUNTIME_DIGEST_PREFIX}:${digest}`)
  )
