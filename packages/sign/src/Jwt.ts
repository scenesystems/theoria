/**
 * Explicit RS256 JWT verification against caller-authenticated JWKS and policy.
 * Cryptographic primitives live separately in the RSA module.
 *
 * @since 0.4.0
 * @module
 */
import {
  Array as Arr,
  Boolean as B,
  Clock,
  Effect,
  Either,
  Encoding,
  identity,
  Number as N,
  Option,
  Redacted,
  Schema,
  String as Str
} from "effect"
import * as Bytes from "./Bytes.js"
import * as Rsa from "./Rsa.js"
import * as Verification from "./Verification.js"

/**
 * A token was rejected without retaining the token, claims, key, or diagnostics.
 * Backend unavailability remains a distinct `VerificationUnavailable` failure.
 * @since 0.4.0
 * @category errors
 */
export class Rejected extends Schema.TaggedError<Rejected>("@scenesystems/sign/Jwt/Rejected")("JwtRejected", {
  reason: Schema.Literal("MalformedToken", "KeySelection", "InvalidKey", "Signature", "Claims", "Policy")
}, {
  title: "JWT rejected",
  description: "An RS256 token failed structural, key, signature, claims, or policy validation."
}) {}

/**
 * Trusted expected issuer, audience, and maximum token lifetime in seconds.
 * Comparisons are exact and case-sensitive. This profile has no clock skew.
 * @since 0.4.0
 * @category schemas
 */
export class Policy extends Schema.Class<Policy>("@scenesystems/sign/Jwt/Policy")({
  issuer: Schema.NonEmptyString,
  audience: Schema.NonEmptyString,
  maxLifetimeSeconds: Schema.Number.pipe(Schema.finite(), Schema.positive())
}, {
  title: "JWT verification policy",
  description: "Trusted issuer, audience, and maximum token lifetime for RS256 verification."
}) {}

const NumericDate = Schema.Number.pipe(Schema.finite())
const Claims = Schema.Struct({
  iss: Schema.NonEmptyString,
  aud: Schema.ArrayEnsure(Schema.NonEmptyString).pipe(Schema.minItems(1)),
  iat: NumericDate,
  exp: NumericDate,
  nbf: Schema.optionalWith(NumericDate, { as: "Option" })
})

const Header = Schema.Struct({
  alg: Schema.Literal("RS256"),
  kid: Schema.NonEmptyString.pipe(Schema.maxLength(128)),
  typ: Schema.optional(Schema.Literal("JWT"))
})

const Segment = Schema.NonEmptyString.pipe(Schema.pattern(/^[A-Za-z0-9_-]+$/))
const Compact = Schema.String.pipe(Schema.maxLength(N.sum(Verification.maxMessageBytes, 684)))
const Jwks = Schema.Struct({ keys: Schema.Array(Schema.Unknown).pipe(Schema.maxItems(100)) })
const KeyId = Schema.Struct({ kid: Schema.optionalWith(Schema.NonEmptyString, { as: "Option" }) })

const decodeJson = (segment: string) =>
  Effect.gen(function*() {
    const text = yield* Encoding.decodeBase64UrlString(segment)
    // Round-trip the original wire encoding: reject replacement decoding, BOM
    // stripping, padding, and nonzero unused base64 bits, without normalizing JSON.
    yield* Effect.succeed(text).pipe(Effect.filterOrFail(
      (decoded) => Str.Equivalence(Encoding.encodeBase64Url(decoded), segment),
      () => new Rejected({ reason: "MalformedToken" })
    ))
    return yield* Schema.decode(Schema.parseJson(Schema.Unknown))(text)
  }).pipe(Effect.mapError(() => new Rejected({ reason: "MalformedToken" })))

/**
 * Verifies a compact RS256 JWT, then decodes its authenticated claims with the
 * application's Schema. Use refinements on that Schema for required subject,
 * email allow-lists, and other authorization policy; no claims escape beforehand.
 *
 * The caller must authenticate the JWKS for the configured issuer. This function
 * performs no HTTP, caching, certificate discovery, or token-directed key lookup.
 * Exactly one key must match `kid`, including when duplicate entries are equal.
 * Only `alg`, `kid`, and optional `typ: JWT` are admitted in the protected header.
 * JSON duplicate names use Schema's ECMAScript last-member semantics (RFC 7519).
 *
 * Requires `iss`, `aud`, `iat`, and `exp`; optional `nbf` is enforced. Expiry is
 * exclusive, issuance/not-before inclusive, and lifetime must be positive and no
 * greater than policy permits. Time comes from Effect's Clock at verification.
 * The application Schema retains its requirements and interruption semantics.
 * @since 0.4.0
 * @category verification
 */
export const verifyRs256 = <A, I, R>(
  token: Redacted.Redacted<string>,
  trustedJwks: unknown,
  policy: Policy,
  claimsSchema: Schema.Schema<A, I, R>
): Effect.Effect<A, Rejected | Verification.Unavailable, R> =>
  Effect.gen(function*() {
    const admittedPolicy = yield* Schema.decode(Policy)({
      issuer: policy.issuer,
      audience: policy.audience,
      maxLifetimeSeconds: policy.maxLifetimeSeconds
    }).pipe(Effect.mapError(() => new Rejected({ reason: "Policy" })))
    const compact = yield* Schema.decode(Compact)(Redacted.value(token)).pipe(
      Effect.mapError(() => new Rejected({ reason: "MalformedToken" }))
    )
    const [encodedHeader, encodedPayload, encodedSignature] = yield* Schema.decodeUnknown(
      Schema.Tuple(Segment, Segment, Segment)
    )(
      Str.split(compact, ".")
    ).pipe(Effect.mapError(() => new Rejected({ reason: "MalformedToken" })))
    const header = yield* Schema.decodeUnknown(Header, { onExcessProperty: "error" })(yield* decodeJson(encodedHeader))
      .pipe(
        Effect.mapError(() => new Rejected({ reason: "MalformedToken" }))
      )
    const candidates = yield* Effect.try({
      try: () =>
        Either.map(Schema.decodeUnknownEither(Jwks)(trustedJwks), (jwks) =>
          Arr.filter(jwks.keys, (key) =>
            Either.match(Schema.decodeUnknownEither(KeyId)(key), {
              onLeft: () =>
                false,
              onRight: (metadata) => Option.exists(metadata.kid, (kid) => Str.Equivalence(kid, header.kid))
            }))),
      catch: () =>
        new Rejected({ reason: "KeySelection" })
    }).pipe(
      Effect.flatMap(identity),
      Effect.mapError(() => new Rejected({ reason: "KeySelection" }))
    )
    const [selected] = yield* Schema.decodeUnknown(Schema.Tuple(Schema.Unknown))(candidates).pipe(
      Effect.mapError(() => new Rejected({ reason: "KeySelection" }))
    )
    const key = yield* Rsa.publicKeyFromJwk(selected).pipe(
      Effect.mapError(() => new Rejected({ reason: "InvalidKey" }))
    )
    const signature = yield* Encoding.decodeBase64Url(encodedSignature).pipe(
      Effect.mapError(() => new Rejected({ reason: "MalformedToken" })),
      Effect.filterOrFail(
        (bytes) => Str.Equivalence(Encoding.encodeBase64Url(bytes), encodedSignature),
        () => new Rejected({ reason: "MalformedToken" })
      )
    )
    yield* Rsa.verify(signature, Bytes.fromString(Arr.join(Arr.make(encodedHeader, encodedPayload), ".")), key).pipe(
      Effect.catchTag("InvalidVerificationInput", () => Effect.fail(new Rejected({ reason: "Signature" }))),
      Effect.filterOrFail(identity, () => new Rejected({ reason: "Signature" }))
    )
    const payload = yield* decodeJson(encodedPayload)
    const claims = yield* Schema.decodeUnknown(Claims)(payload).pipe(
      Effect.mapError(() => new Rejected({ reason: "Claims" }))
    )
    const now = N.unsafeDivide(yield* Clock.currentTimeMillis, 1000)
    yield* Effect.succeed(claims).pipe(Effect.filterOrFail(
      (value) =>
        B.every(Arr.make(
          Str.Equivalence(value.iss, admittedPolicy.issuer),
          Arr.contains(value.aud, admittedPolicy.audience),
          N.lessThanOrEqualTo(value.iat, now),
          N.greaterThan(value.exp, now),
          N.greaterThan(value.exp, value.iat),
          N.lessThanOrEqualTo(N.subtract(value.exp, value.iat), admittedPolicy.maxLifetimeSeconds),
          Option.match(value.nbf, { onNone: () => true, onSome: N.lessThanOrEqualTo(now) })
        )),
      () => new Rejected({ reason: "Claims" })
    ))
    return yield* Schema.decodeUnknown(claimsSchema)(payload).pipe(
      Effect.mapError(() => new Rejected({ reason: "Claims" }))
    )
  })
