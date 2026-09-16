/**
 * Verification-only RSASSA-PKCS1-v1_5 with SHA-256 and RSA JWK import.
 *
 * @since 0.5.0
 * @module
 */
import { pow } from "@noble/curves/abstract/modular.js"
import { bitLen, numberToBytesBE } from "@noble/curves/utils.js"
import { sha256 } from "@scenesystems/digest"
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
import * as Bytes from "./Bytes.js"
import { copyBytes } from "./internal/verificationInput.js"
import * as Verification from "./Verification.js"

/**
 * A malformed or unsupported RSA public key.
 * Retains neither rejected key material nor parser diagnostics.
 *
 * @since 0.5.0
 * @category errors
 */
export class InvalidPublicKey extends Schema.TaggedError<InvalidPublicKey>(
  "@scenesystems/sign/Rsa/InvalidPublicKey"
)("InvalidRsaPublicKey", {}, {
  title: "Invalid RSA public key",
  description: "The supplied RSA key is malformed or outside the supported RS256 profile."
}) {}

const OddPositive = Schema.BigIntFromSelf.pipe(
  Schema.positiveBigInt(),
  Schema.filter((value) => BI.Equivalence(BI.gcd(value, 2n), 1n))
)

/**
 * Public integers for a supported RSA verification key.
 * Requires an odd 2048–4096-bit modulus and odd exponent from 3 through 2³²−1.
 * Admission proves neither prime factorization nor provenance. Encoded fields
 * remain bigints; use publicKeyFromJwk for canonical external JWK decoding.
 *
 * @since 0.5.0
 * @category schemas
 */
export class PublicKey extends Schema.Class<PublicKey>("@scenesystems/sign/Rsa/PublicKey")({
  modulus: OddPositive.pipe(Schema.filter((value) => N.between(bitLen(value), { minimum: 2048, maximum: 4096 }))),
  exponent: OddPositive.pipe(Schema.betweenBigInt(3n, 4_294_967_295n))
}, {
  title: "RSA public key",
  description: "An odd 2048–4096-bit modulus and supported odd public exponent."
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
    yield* Effect.succeed(bytes).pipe(
      Effect.filterOrFail(
        (value) =>
          B.and(
            Str.Equivalence(Encoding.encodeBase64Url(value), encoded),
            Option.exists(Arr.head(Arr.fromIterable(value)), N.greaterThan(0))
          ),
        () => new InvalidPublicKey({})
      )
    )
    return yield* Schema.decode(Schema.BigInt)(Str.concat("0x", Encoding.encodeHex(bytes)))
  })

/**
 * Imports canonical RFC 7518 RSA public integers from an untrusted JWK.
 * Admits unpadded Base64urlUInt n/e. Optional alg, use, and key_ops must permit
 * only RS256 verification. Discards extra fields, including private material;
 * follows no certificate, URL, or trust chain. Invalid keys fail with the
 * material-free InvalidPublicKey error.
 *
 * @since 0.5.0
 * @category keys
 */
export const publicKeyFromJwk = (input: unknown): Effect.Effect<PublicKey, InvalidPublicKey> =>
  Effect.gen(function*() {
    const jwk = yield* Effect.try({
      try: () => Schema.decodeUnknownEither(Jwk)(input),
      catch: () => new InvalidPublicKey({})
    }).pipe(Effect.flatMap(identity))
    return yield* Schema.decode(PublicKey)({
      modulus: yield* decodeInteger(jwk.n),
      exponent: yield* decodeInteger(jwk.e)
    })
  }).pipe(Effect.mapError(() => new InvalidPublicKey({})))

/**
 * Verifies fixed-profile RS256 over exact message bytes.
 * Hashes once with SHA-256 and requires a modulus-width signature whose integer
 * is below the modulus. Compares the complete RFC 8017 PKCS1-v1_5 encoding,
 * including FF padding and DER DigestInfo with NULL parameters. Alternate BER
 * and missing-NULL encodings do not verify.
 *
 * Admits and copies inputs on every execution, including the inclusive
 * Verification.maxMessageBytes bound. Invalid input is Verification.InvalidInput;
 * an admitted nonmatch is false; backend failure is Verification.Unavailable.
 * Errors are material-free. Public arithmetic is synchronous and not preemptible.
 * This Theoria scheme composition is not covered by Noble's dependency audits.
 *
 * @since 0.5.0
 * @category verification
 */
export const verify = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: PublicKey
): Effect.Effect<boolean, Verification.InvalidInput | Verification.Unavailable> =>
  Effect.gen(function*() {
    const key = yield* Effect.try({
      try: () => Schema.decodeUnknownEither(PublicKey)({ modulus: publicKey.modulus, exponent: publicKey.exponent }),
      catch: () => new Verification.InvalidInput({})
    }).pipe(
      Effect.flatMap(identity),
      Effect.mapError(() => new Verification.InvalidInput({}))
    )
    const bits = bitLen(key.modulus)
    const remainingBits = N.remainder(bits, 8)
    const width = N.sum(
      N.unsafeDivide(N.subtract(bits, remainingBits), 8),
      B.match(N.Equivalence(remainingBits, 0), { onTrue: () => 0, onFalse: () => 1 })
    )
    const detachedSignature = yield* copyBytes(signature, Schema.Literal(width))
    const detachedMessage = yield* copyBytes(
      message,
      Schema.NonNegativeInt.pipe(Schema.lessThanOrEqualTo(Verification.maxMessageBytes))
    )
    const representative = yield* Schema.decode(Schema.BigInt)(
      Str.concat("0x", Encoding.encodeHex(detachedSignature))
    ).pipe(Effect.mapError(() => new Verification.InvalidInput({})))
    yield* Effect.succeed(detachedSignature).pipe(
      Effect.filterOrFail(
        () => BI.lessThan(representative, key.modulus),
        () => new Verification.InvalidInput({})
      )
    )
    const digestInfoPrefix = yield* Encoding.decodeHex("3031300d060960864801650304020105000420").pipe(
      Effect.mapError(() => new Verification.Unavailable({}))
    )
    const actual = yield* Effect.try({
      try: () => numberToBytesBE(pow(representative, key.exponent, key.modulus), width),
      catch: () => new Verification.Unavailable({})
    })
    const digest = yield* sha256(detachedMessage).pipe(
      Effect.catchAllDefect(() => Effect.fail(new Verification.Unavailable({})))
    )
    const expected = yield* Schema.decode(Schema.Uint8Array)(Arr.flatten(Arr.make(
      Arr.make(0, 1),
      Arr.replicate(255, N.subtract(width, 54)),
      Arr.of(0),
      Arr.fromIterable(digestInfoPrefix),
      Arr.fromIterable(digest)
    ))).pipe(Effect.mapError(() => new Verification.Unavailable({})))
    return Bytes.equal(actual, expected)
  })
