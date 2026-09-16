import { blake3Hash, encodeUtf8, toBase64Url } from "@scenesystems/digest"
import type { InvalidUnicode } from "@scenesystems/digest"
import {
  Array as Arr,
  Chunk,
  Effect,
  Encoding,
  Equal,
  Match,
  Number as Num,
  Option,
  Order,
  Predicate,
  Record as Rec,
  Schema
} from "effect"

import { RuntimeFingerprintError } from "../../Cache.js"

const runtimeDigestPrefix = "runtime-blake3-256"
const isFinite = Schema.is(Schema.Finite)
const isInt8Array = Schema.is(Schema.instanceOf(Int8Array))

const isNan = (value: number): boolean =>
  Predicate.not((candidate: number) => Equal.equals(candidate, candidate))(value)

const isStruct = (input: unknown): input is Rec.ReadonlyRecord<string, unknown> =>
  Match.value(input).pipe(
    Match.when(Predicate.isRecord, (record) =>
      Predicate.or(
        (value: object) => Equal.equals(Object.getPrototypeOf(value), Object.prototype),
        (value: object) => Predicate.isNull(Object.getPrototypeOf(value))
      )(record)),
    Match.orElse(() => false)
  )

const int8AsUint8 = (input: Int8Array): Uint8Array => new Uint8Array(input.buffer, input.byteOffset, input.byteLength)

const numberToken = (value: number): string =>
  Match.value(value).pipe(
    Match.when(isNan, () => "num:nan"),
    Match.when(isFinite, (finite) =>
      Match.value(Object.is(finite, -0)).pipe(
        Match.when(true, () => "num:-0"),
        Match.orElse(() => `num:${finite}`)
      )),
    Match.when(Num.greaterThan(0), () => "num:+inf"),
    Match.orElse(() => "num:-inf")
  )

const taggedIdentityTokens = (value: Rec.ReadonlyRecord<string, unknown>): Chunk.Chunk<string> =>
  Option.fromNullable(value["_tag"]).pipe(
    Option.filter(Predicate.isString),
    Option.match({
      onNone: () => Chunk.empty(),
      onSome: (tag) => Chunk.of(`variant:${tag}`)
    })
  )

const unsupportedValue = (reason: RuntimeFingerprintError["reason"]): Effect.Effect<never, RuntimeFingerprintError> =>
  Effect.fail(new RuntimeFingerprintError({ reason }))

const arrayTokens = (values: Iterable<unknown>): Effect.Effect<Chunk.Chunk<string>, RuntimeFingerprintError> => {
  const entries = Chunk.fromIterable(values)
  const size = Chunk.size(entries)
  return Effect.forEach(entries, canonicalTokens).pipe(
    Effect.map((members) =>
      Arr.reduce(
        members,
        Chunk.of(`arr:${size}:start`),
        (tokens, entry) => Chunk.appendAll(tokens, entry)
      )
    ),
    Effect.map((tokens) => Chunk.append(tokens, `arr:${size}:end`))
  )
}

const structTokens = (
  record: Rec.ReadonlyRecord<string, unknown>
): Effect.Effect<Chunk.Chunk<string>, RuntimeFingerprintError> => {
  const sortedKeys = Arr.sort(Rec.keys(record), Order.string)
  const initial = Chunk.appendAll(Chunk.of(`obj:${Arr.length(sortedKeys)}:start`), taggedIdentityTokens(record))

  return Effect.forEach(
    sortedKeys,
    (key) =>
      canonicalTokens(record[key]).pipe(
        Effect.map((tokens) => Chunk.appendAll(Chunk.of(`key:${key}`), tokens))
      )
  ).pipe(
    Effect.map((fields) => Arr.reduce(fields, initial, (tokens, field) => Chunk.appendAll(tokens, field))),
    Effect.map((tokens) => Chunk.append(tokens, `obj:${Arr.length(sortedKeys)}:end`))
  )
}

const canonicalTokens = (value: unknown): Effect.Effect<Chunk.Chunk<string>, RuntimeFingerprintError> =>
  Match.value(value).pipe(
    Match.when(Predicate.isUndefined, () => Effect.succeed(Chunk.of("undefined"))),
    Match.when(Predicate.isNull, () => Effect.succeed(Chunk.of("null"))),
    Match.when(Predicate.isBoolean, (boolean) =>
      Match.value(boolean).pipe(
        Match.when(true, () => Effect.succeed(Chunk.of("bool:1"))),
        Match.orElse(() => Effect.succeed(Chunk.of("bool:0")))
      )),
    Match.when(Predicate.isNumber, (number) => Effect.succeed(Chunk.of(numberToken(number)))),
    Match.when(Predicate.isString, (text) => Effect.succeed(Chunk.of(`str:${text}`))),
    Match.when(Predicate.isBigInt, (entry) => Effect.succeed(Chunk.of(`bigint:${entry}`))),
    Match.when(Predicate.isDate, (date) =>
      Match.value(date.getTime()).pipe(
        Match.when(isNan, () => Effect.succeed(Chunk.of("date:invalid"))),
        Match.orElse(() => Effect.succeed(Chunk.of(`date:${date.toISOString()}`)))
      )),
    Match.when(
      Predicate.isUint8Array,
      (bytes) => Effect.succeed(Chunk.of(`bytes:uint8:${bytes.byteLength}:${Encoding.encodeHex(bytes)}`))
    ),
    Match.when(isInt8Array, (bytes) => {
      const unsigned = int8AsUint8(bytes)
      return Effect.succeed(Chunk.of(`bytes:int8:${unsigned.byteLength}:${Encoding.encodeHex(unsigned)}`))
    }),
    Match.when(Arr.isArray, arrayTokens),
    Match.when(isStruct, structTokens),
    Match.when(Predicate.isSymbol, () => unsupportedValue("symbol")),
    Match.when(Predicate.isFunction, () => unsupportedValue("function")),
    Match.orElse(() => unsupportedValue("unsupported-value"))
  )

const tokenPayload = (tokens: Chunk.Chunk<string>): string =>
  Chunk.reduce(tokens, "", (payload, token) => `${payload}${token.length}:${token};`)

const digestTokens = (tokens: Chunk.Chunk<string>): Effect.Effect<string, InvalidUnicode> =>
  encodeUtf8(tokenPayload(tokens)).pipe(
    Effect.flatMap(blake3Hash),
    Effect.map(toBase64Url)
  )

export const runtimeFingerprint = (
  value: unknown
): Effect.Effect<string, InvalidUnicode | RuntimeFingerprintError> =>
  canonicalTokens(value).pipe(
    Effect.flatMap(digestTokens),
    Effect.map((digest) => `${runtimeDigestPrefix}:${digest}`)
  )
