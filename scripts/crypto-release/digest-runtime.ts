import * as Digest from "@scenesystems/digest"
import { Array as Arr, Effect, Either, Match, Option, Schema } from "effect"

import { type DigestKat, DigestKatFailure, DigestKatProfile, type DigestRuntimeReport } from "./digest-schema.ts"

const failKat = (katId: string, operation: string): Effect.Effect<never, DigestKatFailure> =>
  new DigestKatFailure({ katId, operation })

const decodeHex = (katId: string, value: string): Effect.Effect<Uint8Array, DigestKatFailure> =>
  Either.match(Digest.fromHex(value), {
    onLeft: () => failKat(katId, "decode-authoritative-hex"),
    onRight: (bytes) => Effect.succeed(bytes)
  })

const verify = (
  katId: string,
  operation: string,
  actual: string | number,
  expected: string | number
): Effect.Effect<void, DigestKatFailure> => actual === expected ? Effect.void : failKat(katId, operation)

const blake3Input = (length: number): Uint8Array =>
  length === 0
    ? new Uint8Array()
    : Uint8Array.from(Arr.makeBy(length, (index) => index % 251))

const runBlake3Hash = (kat: Extract<DigestKat, { readonly _tag: "Blake3Hash" }>) =>
  Effect.gen(function*() {
    const output = yield* Digest.blake3Hash(blake3Input(kat.inputLength))
    yield* verify(kat.id, "blake3-hash", Digest.toHex(output), kat.expectedHex)
  })

const runBlake3Mac = (kat: Extract<DigestKat, { readonly _tag: "Blake3Mac" }>) =>
  Effect.gen(function*() {
    const key = yield* Digest.encodeUtf8(kat.key).pipe(
      Effect.mapError(() => new DigestKatFailure({ katId: kat.id, operation: "encode-blake3-key" }))
    )
    const output = yield* Digest.blake3Mac(key, blake3Input(kat.inputLength)).pipe(
      Effect.mapError(() => new DigestKatFailure({ katId: kat.id, operation: "blake3-key-length" }))
    )
    yield* verify(kat.id, "blake3-mac", Digest.toHex(output), kat.expectedHex)
  })

const runBlake3DeriveKey = (kat: Extract<DigestKat, { readonly _tag: "Blake3DeriveKey" }>) =>
  Effect.gen(function*() {
    const output = yield* Digest.blake3DeriveKey(kat.context, blake3Input(kat.inputLength)).pipe(
      Effect.mapError(() => new DigestKatFailure({ katId: kat.id, operation: "blake3-derive-context" }))
    )
    yield* verify(kat.id, "blake3-derive-key", Digest.toHex(output), kat.expectedHex)
  })

const runSha256 = (kat: Extract<DigestKat, { readonly _tag: "Sha256" }>) =>
  Effect.gen(function*() {
    const input = yield* decodeHex(kat.id, kat.inputHex)
    const output = yield* Digest.sha256(input)
    yield* verify(kat.id, "sha256", Digest.toHex(output), kat.expectedHex)
  })

const runHmac = (kat: Extract<DigestKat, { readonly _tag: "Hmac" }>) =>
  Effect.gen(function*() {
    const key = yield* decodeHex(kat.id, kat.keyHex)
    const message = yield* decodeHex(kat.id, kat.messageHex)
    const output = yield* kat.algorithm === "hmac-sha1"
      ? Digest.hmacSha1(key, message)
      : Digest.hmacSha256(key, message)
    yield* verify(
      kat.id,
      kat.algorithm,
      Digest.toHex(output.slice(0, kat.outputLength)),
      kat.expectedHex
    )
  })

const runHkdf = (kat: Extract<DigestKat, { readonly _tag: "Hkdf" }>) =>
  Effect.gen(function*() {
    const ikm = yield* decodeHex(kat.id, kat.ikmHex)
    const info = yield* decodeHex(kat.id, kat.infoHex)
    const salt = yield* Option.match(Option.fromNullable(kat.saltHex), {
      onNone: () => Effect.succeed(Option.none<Uint8Array>()),
      onSome: (hex) => Effect.map(decodeHex(kat.id, hex), Option.some)
    })
    const output = yield* kat.algorithm === "hkdf-sha256"
      ? Digest.hkdfSha256(ikm, salt, info, kat.outputLength)
      : Digest.hkdfSha512(ikm, salt, info, kat.outputLength)
    yield* verify(kat.id, kat.algorithm, Digest.toHex(output), kat.expectedHex)
  })

const runJcs = (kat: Extract<DigestKat, { readonly _tag: "Jcs" }>) =>
  Effect.gen(function*() {
    const canonical = yield* Digest.canonicalize(kat.input).pipe(
      Effect.mapError(() => new DigestKatFailure({ katId: kat.id, operation: "canonicalize" }))
    )
    const bytes = yield* Digest.canonicalJsonBytes(kat.input).pipe(
      Effect.mapError(() => new DigestKatFailure({ katId: kat.id, operation: "canonical-json-bytes" }))
    )
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    yield* verify(kat.id, "canonicalize", canonical, kat.expectedCanonical)
    yield* verify(kat.id, "canonical-json-bytes", decoded, kat.expectedCanonical)
  })

const runSchemaValueByteLimit = (kat: Extract<DigestKat, { readonly _tag: "SchemaValueByteLimit" }>) =>
  Effect.gen(function*() {
    const existing = yield* Digest.digestSchemaValue(Schema.Unknown, kat.input).pipe(
      Effect.mapError(() => new DigestKatFailure({ katId: kat.id, operation: "schema-digest-existing" }))
    )
    const exact = yield* Digest.digestSchemaValueWithByteLimit(
      Schema.Unknown,
      kat.input,
      kat.maximumBytes
    ).pipe(
      Effect.mapError(() => new DigestKatFailure({ katId: kat.id, operation: "schema-digest-exact-bound" }))
    )
    const excess = yield* Digest.digestSchemaValueWithByteLimit(
      Schema.Unknown,
      kat.input,
      kat.maximumBytes - 1
    ).pipe(
      Effect.matchEffect({
        onFailure: Effect.succeed,
        onSuccess: () => failKat(kat.id, "schema-digest-bound-plus-one-accepted")
      })
    )
    const invalid = yield* Digest.digestSchemaValueWithByteLimit(
      Schema.Unknown,
      kat.input,
      -1
    ).pipe(
      Effect.matchEffect({
        onFailure: Effect.succeed,
        onSuccess: () => failKat(kat.id, "schema-digest-invalid-limit-accepted")
      })
    )

    yield* verify(kat.id, "schema-digest-existing", existing, kat.expectedDigest)
    yield* verify(kat.id, "schema-digest-exact-bound", exact.digest, kat.expectedDigest)
    yield* verify(kat.id, "schema-digest-canonical-byte-length", exact.canonicalByteLength, kat.maximumBytes)
    if (excess._tag !== "CanonicalByteLimitExceeded") {
      return yield* failKat(kat.id, "schema-digest-excess-classification")
    }
    if (invalid._tag !== "InvalidCanonicalByteLimit") {
      return yield* failKat(kat.id, "schema-digest-invalid-limit-classification")
    }
  })

const runInvalidUnicode = (kat: Extract<DigestKat, { readonly _tag: "InvalidUnicode" }>) =>
  Effect.gen(function*() {
    const input = kat.target === "key" ? { [kat.input]: "value" } : kat.input
    const error = yield* Digest.canonicalize(input).pipe(
      Effect.matchEffect({
        onFailure: Effect.succeed,
        onSuccess: () => failKat(kat.id, "invalid-unicode-accepted")
      })
    )

    if (error._tag !== "InvalidUnicode") {
      return yield* failKat(kat.id, "invalid-unicode-tag")
    }

    yield* verify(kat.id, "invalid-unicode-kind", error.kind, kat.expectedKind)
    yield* verify(kat.id, "invalid-unicode-index", error.codeUnitIndex, kat.expectedCodeUnitIndex)
  })

const runKat = (kat: DigestKat): Effect.Effect<void, DigestKatFailure> =>
  Match.value(kat).pipe(
    Match.tag("Blake3Hash", runBlake3Hash),
    Match.tag("Blake3Mac", runBlake3Mac),
    Match.tag("Blake3DeriveKey", runBlake3DeriveKey),
    Match.tag("Sha256", runSha256),
    Match.tag("Hmac", runHmac),
    Match.tag("Hkdf", runHkdf),
    Match.tag("Jcs", runJcs),
    Match.tag("SchemaValueByteLimit", runSchemaValueByteLimit),
    Match.tag("InvalidUnicode", runInvalidUnicode),
    Match.exhaustive
  )

export const runDigestRuntimeProfile = (
  input: unknown
): Effect.Effect<DigestRuntimeReport, DigestKatFailure> =>
  Effect.gen(function*() {
    const profile = yield* Schema.decodeUnknown(DigestKatProfile)(input).pipe(
      Effect.mapError(() => new DigestKatFailure({ katId: "profile", operation: "decode-profile" }))
    )
    yield* Effect.forEach(profile.cases, runKat, { discard: true })

    return {
      format: "digest-packed-runtime-report-v1",
      katIds: Arr.map(profile.cases, (kat) => kat.id),
      katCount: profile.cases.length
    }
  })
