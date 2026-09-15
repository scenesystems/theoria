import { Schema } from "effect"

export const JwtFixture = Schema.Struct({
  generator: Schema.String,
  jwk: Schema.Struct({
    kty: Schema.Literal("RSA"),
    kid: Schema.String,
    alg: Schema.Literal("RS256"),
    n: Schema.String,
    e: Schema.String
  }),
  cases: Schema.NonEmptyArray(Schema.Struct({
    name: Schema.String,
    token: Schema.String,
    expected: Schema.Literal("valid", "Claims", "MalformedToken")
  }))
})
