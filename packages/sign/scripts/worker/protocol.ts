/** Verification-only HTTP boundary for the packed package executing inside workerd. */
import { Jwt, Rsa, Verification } from "@scenesystems/sign"
import { Schema } from "effect"

export const Identity = Schema.Struct({ sub: Schema.NonEmptyString, email: Schema.Literal("reader@example.test") })

export const Request = Schema.Union(
  Schema.TaggedStruct("Ping", {}),
  Schema.TaggedStruct("Rsa", {
    jwk: Schema.Unknown,
    signature: Schema.Uint8ArrayFromHex,
    message: Schema.Uint8ArrayFromHex
  }),
  Schema.TaggedStruct("Jwt", {
    token: Schema.String,
    jwks: Schema.Unknown,
    nowMillis: Schema.NonNegativeInt
  })
)

export const RequestBody = Schema.encodedSchema(Request)

export const Result = Schema.Union(
  Schema.Boolean,
  Identity,
  Jwt.Rejected,
  Rsa.InvalidPublicKey,
  Verification.InvalidInput,
  Verification.Unavailable
)
