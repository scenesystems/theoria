/**
 * Verification-only RSASSA-PKCS1-v1_5 with SHA-256 and public RSA JWK import.
 *
 * @since 0.4.0
 * @module
 */
import { pow } from "@noble/curves/abstract/modular.js"
import { bitLen, bytesToNumberBE, numberToBytesBE } from "@noble/curves/utils.js"
import { sha256 } from "@noble/hashes/sha2.js"
import {
  Array as Arr,
  BigInt as BI,
  Boolean as B,
  Effect,
  Encoding,
  identity,
  Number as N,
  Option,
  Schema,
  String as Str
} from "effect"
import { equalBytes } from "../encoding.js"
import { copyBytes, DIRECT_VERIFICATION_MAX_MESSAGE_BYTES } from "../internal/verificationInput.js"
import { InvalidVerificationInput, VerificationUnavailable } from "../schemas/errors.js"

/**
 * The JWK is malformed or outside the supported RSA verification profile.
 * No rejected key or parser diagnostic is retained.
 * @since 0.4.0
 * @category errors
 */
export class InvalidRsaPublicKey extends Schema.TaggedError<InvalidRsaPublicKey>()("InvalidRsaPublicKey", {}) {}

const OddPositive = Schema.BigIntFromSelf.pipe(
  Schema.positiveBigInt(),
  Schema.filter((value) => BI.Equivalence(BI.gcd(value, 2n), 1n))
)

/**
 * Immutable RSA public integers: an odd 2048–4096-bit modulus and an odd public
 * exponent from 3 through 2³²−1. Admission does not prove the modulus's factorization
 * or establish the key's provenance; callers must authenticate the public key.
 * @since 0.4.0
 * @category schemas
 */
export class RsaPublicKey extends Schema.Class<RsaPublicKey>("RsaPublicKey")({
  modulus: OddPositive.pipe(Schema.filter((value) => N.between(bitLen(value), { minimum: 2048, maximum: 4096 }))),
  exponent: OddPositive.pipe(Schema.betweenBigInt(3n, 4_294_967_295n))
}) {}

const Jwk = Schema.Struct({
  kty: Schema.Literal("RSA"),
  n: Schema.String.pipe(Schema.minLength(342), Schema.maxLength(683)),
  e: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(6)),
  alg: Schema.optional(Schema.Literal("RS256")),
  use: Schema.optional(Schema.Literal("sig")),
  key_ops: Schema.optional(Schema.Tuple(Schema.Literal("verify")))
})

const decodeInteger = (encoded: string) =>
  Effect.gen(function*() {
    const bytes = yield* Encoding.decodeBase64Url(encoded)
    yield* Effect.succeed(bytes).pipe(Effect.filterOrFail(
      (value) =>
        B.and(
          Str.Equivalence(Encoding.encodeBase64Url(value), encoded),
          Option.exists(Arr.head(Arr.fromIterable(value)), N.greaterThan(0))
        ),
      () => new InvalidRsaPublicKey({})
    ))
    return bytesToNumberBE(bytes)
  })

/**
 * Imports canonical RFC 7518 Base64urlUInt `n` and `e` from an untrusted JWK.
 * Optional `alg`, `use`, and `key_ops` must permit only RS256 verification.
 * Extra fields (including private material) are discarded, never retained.
 * No certificate, URL, or trust chain is followed.
 * @since 0.4.0
 * @category keys
 */
export const rsaPublicKeyFromJwk = (input: unknown): Effect.Effect<RsaPublicKey, InvalidRsaPublicKey> =>
  Effect.gen(function*() {
    const jwk = yield* Effect.try({
      try: () => Schema.decodeUnknownEither(Jwk)(input),
      catch: () => new InvalidRsaPublicKey({})
    }).pipe(Effect.flatMap(identity))
    return yield* Schema.decode(RsaPublicKey)({
      modulus: yield* decodeInteger(jwk.n),
      exponent: yield* decodeInteger(jwk.e)
    })
  }).pipe(Effect.mapError(() => new InvalidRsaPublicKey({})))

const Input = Schema.Struct({
  signature: Schema.Uint8ArrayFromSelf.pipe(
    Schema.filter((bytes) => N.between(bytes.length, { minimum: 256, maximum: 512 }))
  ),
  message: Schema.Uint8ArrayFromSelf.pipe(
    Schema.filter((bytes) => N.lessThanOrEqualTo(bytes.length, DIRECT_VERIFICATION_MAX_MESSAGE_BYTES))
  )
})

/**
 * Verifies RS256 over the exact message bytes (at most 8192 bytes), hashing once.
 * Requires a modulus-width signature with representative less than the modulus.
 * Strict RFC 8017 encoding includes the entire FF padding and SHA-256 DER
 * DigestInfo, including NULL parameters; alternate BER encodings are rejected.
 *
 * Inputs are validated and detached on execution. Invalid input fails with a
 * material-free typed error; an admitted nonmatch returns false. Noble's public
 * arithmetic processes public data synchronously, bounded by the key profile.
 * This Theoria scheme composition is not covered by Noble's dependency audits.
 * @since 0.4.0
 * @category algorithms
 */
export const rsaSha256Verify = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: RsaPublicKey
): Effect.Effect<boolean, InvalidVerificationInput | VerificationUnavailable> =>
  Effect.gen(function*() {
    const key = yield* Effect.try({
      try: () => Schema.decodeUnknownEither(RsaPublicKey)({ modulus: publicKey.modulus, exponent: publicKey.exponent }),
      catch: () => new InvalidVerificationInput({})
    }).pipe(
      Effect.flatMap(identity),
      Effect.mapError(() => new InvalidVerificationInput({}))
    )
    const input = yield* Effect.try({
      try: () => Schema.decodeUnknownEither(Input)({ signature, message }),
      catch: () => new InvalidVerificationInput({})
    }).pipe(
      Effect.flatMap(identity),
      Effect.mapError(() => new InvalidVerificationInput({}))
    )
    const detachedSignature = yield* copyBytes(input.signature)
    const detachedMessage = yield* copyBytes(input.message)
    const bits = bitLen(key.modulus)
    const remainingBits = N.remainder(bits, 8)
    const width = N.sum(
      N.unsafeDivide(N.subtract(bits, remainingBits), 8),
      B.match(N.Equivalence(remainingBits, 0), { onTrue: () => 0, onFalse: () => 1 })
    )
    const representative = bytesToNumberBE(detachedSignature)
    yield* Effect.succeed(detachedSignature).pipe(Effect.filterOrFail(
      (bytes) => B.and(N.Equivalence(bytes.length, width), BI.lessThan(representative, key.modulus)),
      () => new InvalidVerificationInput({})
    ))
    const digestInfoPrefix = yield* Encoding.decodeHex("3031300d060960864801650304020105000420").pipe(
      Effect.mapError(() => new VerificationUnavailable({}))
    )
    const actual = yield* Effect.try({
      try: () => numberToBytesBE(pow(representative, key.exponent, key.modulus), width),
      catch: () => new VerificationUnavailable({})
    })
    const digest = yield* Effect.try({
      try: () => sha256(detachedMessage),
      catch: () => new VerificationUnavailable({})
    })
    const expected = yield* Schema.decode(Schema.Uint8Array)(Arr.flatten(Arr.make(
      Arr.make(0, 1),
      Arr.replicate(255, N.subtract(width, 54)),
      Arr.of(0),
      Arr.fromIterable(digestInfoPrefix),
      Arr.fromIterable(digest)
    ))).pipe(Effect.mapError(() => new VerificationUnavailable({})))
    return equalBytes(actual, expected)
  })
