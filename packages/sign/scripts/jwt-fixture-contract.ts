import { Schema } from "effect"
import { RsaPublicJwk } from "./fixture-contract.js"

export const JwtExpected = Schema.Literals(["valid", "Claims", "MalformedToken"])

export const JwtPublicJwk = Schema.Struct({
  ...RsaPublicJwk.fields,
  kid: Schema.String,
  alg: Schema.Literal("RS256")
})

export const JwtCase = Schema.Struct({
  name: Schema.String,
  token: Schema.String,
  expected: JwtExpected
})

export const JwtFixture = Schema.Struct({
  generator: Schema.String,
  jwk: JwtPublicJwk,
  cases: Schema.NonEmptyArray(JwtCase)
})
