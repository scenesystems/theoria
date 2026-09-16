/**
 * Generate independently signed JWT policy fixtures using the system OpenSSL.
 * OpenSSL verifies every signature before any fixture is retained. Run with Bun
 * from any directory. Ephemeral private keys are scoped and never retained.
 * Regeneration changes keys and signatures, not expected policy.
 */
import { Command, FileSystem, Path, Url } from "@effect/platform"
import * as BunContext from "@effect/platform-bun/BunContext"
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import { Array as Arr, Data, Effect, Encoding, Schema, String as Str } from "effect"
import { requireExit } from "./fixture-contract.js"
import { JwtCase, JwtExpected, JwtFixture } from "./jwt-fixture-contract.js"

const JwtSpecification = Schema.Struct({
  name: Schema.String,
  payload: Schema.Union(Schema.String, Schema.Uint8ArrayFromSelf),
  header: Schema.String,
  expected: JwtExpected
})

const JwtCorpus = Schema.Struct({
  file: Schema.Literal("jwt-openssl.json", "jwt-access-openssl.json"),
  kid: Schema.String,
  specifications: Schema.NonEmptyArray(JwtSpecification)
})

const base =
  "{ \"iss\": \"https://team.example\", \"aud\": \"app\", \"iat\": 100, \"exp\": 200, \"nbf\": 100, \"sub\": \"user-7\", \"email\": \"reader@example.test\" }"
const header = "{ \"typ\": \"JWT\", \"kid\": \"fixture\", \"alg\": \"RS256\" }"
const accessHeader = "{ \"typ\": \"JWT\", \"kid\": \"access-fixture\", \"alg\": \"RS256\" }"
const valid: typeof JwtExpected.Type = "valid"
const claims: typeof JwtExpected.Type = "Claims"
const malformedToken: typeof JwtExpected.Type = "MalformedToken"

const program = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const generator = Str.trim(yield* Command.string(Command.make("openssl", "version")))
  const malformedUtf8 = yield* Encoding.decodeHex("7b226578747261223a22ff227d")
  const corpora = Arr.make(
    JwtCorpus.make({
      file: "jwt-openssl.json",
      kid: "fixture",
      specifications: Arr.make<Arr.NonEmptyArray<typeof JwtSpecification.Type>>(
        { name: "spaced JSON", payload: base, header, expected: valid },
        {
          name: "audience second in array",
          payload: Str.replace("\"aud\": \"app\"", "\"aud\": [\"other\", \"app\"]")(base),
          header,
          expected: valid
        },
        { name: "not-before absent", payload: Str.replace("\"nbf\": 100, ", "")(base), header, expected: valid },
        {
          name: "wrong issuer",
          payload: Str.replace("https://team.example", "https://other.example")(base),
          header,
          expected: claims
        },
        {
          name: "wrong audience",
          payload: Str.replace("\"aud\": \"app\"", "\"aud\": \"other\"")(base),
          header,
          expected: claims
        },
        {
          name: "expiry equal to now",
          payload: Str.replace("\"exp\": 200", "\"exp\": 150")(base),
          header,
          expected: claims
        },
        {
          name: "future issuance",
          payload: Str.replace("\"iat\": 100", "\"iat\": 151")(base),
          header,
          expected: claims
        },
        {
          name: "future not-before",
          payload: Str.replace("\"nbf\": 100", "\"nbf\": 151")(base),
          header,
          expected: claims
        },
        {
          name: "excess lifetime",
          payload: Str.replace("\"exp\": 200", "\"exp\": 4000")(base),
          header,
          expected: claims
        },
        { name: "missing expiry", payload: Str.replace("\"exp\": 200, ", "")(base), header, expected: claims },
        {
          name: "wrong expiry type",
          payload: Str.replace("\"exp\": 200", "\"exp\": \"200\"")(base),
          header,
          expected: claims
        },
        {
          name: "denied email",
          payload: Str.replace("reader@example.test", "denied@example.test")(base),
          header,
          expected: claims
        },
        {
          name: "missing subject",
          payload: Str.replace("\"sub\": \"user-7\", ", "")(base),
          header,
          expected: claims
        },
        {
          name: "last duplicate claim wins",
          payload: Str.replace("\"aud\": \"app\"", "\"aud\": \"other\", \"aud\": \"app\"")(base),
          header,
          expected: valid
        },
        {
          name: "algorithm confusion",
          payload: base,
          header: Str.replace("RS256", "HS256")(header),
          expected: malformedToken
        },
        {
          name: "unsupported critical header",
          payload: base,
          header: Str.replace("\"typ\": \"JWT\"", "\"crit\": [\"b64\"], \"b64\": false")(header),
          expected: malformedToken
        },
        { name: "malformed signed JSON", payload: "{", header, expected: malformedToken },
        {
          name: "signed BOM is not silently stripped",
          payload: Str.concat("\uFEFF", base),
          header,
          expected: malformedToken
        },
        { name: "malformed UTF-8 is not replaced", payload: malformedUtf8, header, expected: malformedToken }
      )
    }),
    JwtCorpus.make({
      file: "jwt-access-openssl.json",
      kid: "access-fixture",
      specifications: Arr.make<Arr.NonEmptyArray<typeof JwtSpecification.Type>>(
        { name: "Access allowed identity", payload: base, header: accessHeader, expected: valid },
        {
          name: "Access audience second in array",
          payload: Str.replace("\"aud\": \"app\"", "\"aud\": [\"other\", \"app\"]")(base),
          header: accessHeader,
          expected: valid
        },
        {
          name: "Access not-before absent",
          payload: Str.replace("\"nbf\": 100, ", "")(base),
          header: accessHeader,
          expected: valid
        },
        {
          name: "Access issuance equal to now is inclusive",
          payload: Str.replace("\"iat\": 100", "\"iat\": 150")(base),
          header: accessHeader,
          expected: valid
        },
        {
          name: "Access not-before equal to now is inclusive",
          payload: Str.replace("\"nbf\": 100", "\"nbf\": 150")(base),
          header: accessHeader,
          expected: valid
        },
        {
          name: "Access lifetime equal to 24 hours",
          payload: Str.replace("\"exp\": 200", "\"exp\": 86500")(base),
          header: accessHeader,
          expected: valid
        },
        {
          name: "Access wrong issuer",
          payload: Str.replace("https://team.example", "https://other.example")(base),
          header: accessHeader,
          expected: claims
        },
        {
          name: "Access wrong audience",
          payload: Str.replace("\"aud\": \"app\"", "\"aud\": \"other\"")(base),
          header: accessHeader,
          expected: claims
        },
        {
          name: "Access expiry equal to now is exclusive",
          payload: Str.replace("\"exp\": 200", "\"exp\": 150")(base),
          header: accessHeader,
          expected: claims
        },
        {
          name: "Access future issuance",
          payload: Str.replace("\"iat\": 100", "\"iat\": 151")(base),
          header: accessHeader,
          expected: claims
        },
        {
          name: "Access future not-before",
          payload: Str.replace("\"nbf\": 100", "\"nbf\": 151")(base),
          header: accessHeader,
          expected: claims
        },
        {
          name: "Access lifetime exceeds 24 hours",
          payload: Str.replace("\"exp\": 200", "\"exp\": 86501")(base),
          header: accessHeader,
          expected: claims
        },
        {
          name: "Access missing issued-at",
          payload: Str.replace("\"iat\": 100, ", "")(base),
          header: accessHeader,
          expected: claims
        },
        {
          name: "Access missing expiry",
          payload: Str.replace("\"exp\": 200, ", "")(base),
          header: accessHeader,
          expected: claims
        },
        {
          name: "Access malformed issued-at",
          payload: Str.replace("\"iat\": 100", "\"iat\": \"100\"")(base),
          header: accessHeader,
          expected: claims
        },
        {
          name: "Access malformed expiry",
          payload: Str.replace("\"exp\": 200", "\"exp\": \"200\"")(base),
          header: accessHeader,
          expected: claims
        },
        {
          name: "Access malformed not-before",
          payload: Str.replace("\"nbf\": 100", "\"nbf\": \"100\"")(base),
          header: accessHeader,
          expected: claims
        },
        {
          name: "Access missing subject",
          payload: Str.replace("\"sub\": \"user-7\", ", "")(base),
          header: accessHeader,
          expected: claims
        },
        {
          name: "Access empty subject",
          payload: Str.replace("user-7", "")(base),
          header: accessHeader,
          expected: claims
        },
        {
          name: "Access missing email",
          payload: Str.replace(", \"email\": \"reader@example.test\"", "")(base),
          header: accessHeader,
          expected: claims
        },
        {
          name: "Access empty email",
          payload: Str.replace("reader@example.test", "")(base),
          header: accessHeader,
          expected: claims
        },
        {
          name: "Access denied email",
          payload: Str.replace("reader@example.test", "denied@example.test")(base),
          header: accessHeader,
          expected: claims
        },
        {
          name: "Access algorithm confusion",
          payload: base,
          header: Str.replace("RS256", "HS256")(accessHeader),
          expected: malformedToken
        },
        {
          name: "Access unsupported critical header",
          payload: base,
          header: Str.replace("\"typ\": \"JWT\"", "\"crit\": [\"b64\"], \"b64\": false")(accessHeader),
          expected: malformedToken
        },
        { name: "Access malformed signed JSON", payload: "{", header: accessHeader, expected: malformedToken },
        {
          name: "Access signed BOM is not silently stripped",
          payload: Str.concat("\uFEFF", base),
          header: accessHeader,
          expected: malformedToken
        },
        {
          name: "Access malformed UTF-8 is not replaced",
          payload: malformedUtf8,
          header: accessHeader,
          expected: malformedToken
        }
      )
    })
  )
  const generated = yield* Effect.forEach(corpora, (corpus) =>
    Effect.gen(function*() {
      const temporary = yield* fs.makeTempDirectoryScoped()
      const keyPath = path.join(temporary, "key.pem")
      const publicKeyPath = path.join(temporary, "public.pem")
      const signaturePath = path.join(temporary, "signature.bin")
      const inputPath = path.join(temporary, "input.txt")
      yield* requireExit(
        Command.make(
          "openssl",
          "genpkey",
          "-algorithm",
          "RSA",
          "-pkeyopt",
          "rsa_keygen_bits:2048",
          "-pkeyopt",
          "rsa_keygen_pubexp:65537",
          "-out",
          keyPath
        ),
        0,
        "generate key"
      )
      yield* requireExit(
        Command.make("openssl", "pkey", "-in", keyPath, "-pubout", "-out", publicKeyPath),
        0,
        "export public key"
      )
      const modulus = yield* Command.string(Command.make("openssl", "rsa", "-in", keyPath, "-modulus", "-noout"))
      const n = Encoding.encodeBase64Url(
        yield* Encoding.decodeHex(Str.trim(Str.replace("Modulus=", "")(modulus)))
      )
      const cases = yield* Effect.forEach(corpus.specifications, (specification) =>
        Effect.gen(function*() {
          const input = Arr.join(
            Arr.make(Encoding.encodeBase64Url(specification.header), Encoding.encodeBase64Url(specification.payload)),
            "."
          )
          yield* fs.writeFileString(inputPath, input)
          yield* requireExit(
            Command.make("openssl", "dgst", "-sha256", "-sign", keyPath, "-out", signaturePath, inputPath),
            0,
            "sign protected input"
          )
          yield* requireExit(
            Command.make(
              "openssl",
              "dgst",
              "-sha256",
              "-verify",
              publicKeyPath,
              "-signature",
              signaturePath,
              inputPath
            ),
            0,
            "verify retained signature"
          )
          const signature = Encoding.encodeBase64Url(yield* fs.readFile(signaturePath))
          return JwtCase.make({
            name: specification.name,
            token: Arr.join(Arr.make(input, signature), "."),
            expected: specification.expected
          })
        }))
      const fixture = JwtFixture.make({
        generator,
        jwk: { kty: "RSA", kid: corpus.kid, alg: "RS256", n, e: "AQAB" },
        cases
      })
      return Data.struct({ file: corpus.file, fixture })
    }).pipe(Effect.scoped))
  yield* Effect.forEach(generated, (result) =>
    Effect.gen(function*() {
      const destination = yield* path.fromFileUrl(
        yield* Url.fromString(Str.concat("../test/fixtures/conformance/", result.file), import.meta.url)
      )
      yield* fs.writeFileString(
        destination,
        yield* Schema.encode(Schema.parseJson(JwtFixture, { space: 2 }))(result.fixture)
      )
    }), { discard: true })
}).pipe(Effect.provide(BunContext.layer))

BunRuntime.runMain(program)
