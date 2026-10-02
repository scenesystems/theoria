/**
 * Conformance fixture contract — schemas for the retained external vectors
 * and their provenance manifest, plus the readers `fixtures:check` and the
 * conformance tests share.
 */
import { Data, Effect, FileSystem, Number as N, Path, Schema, Struct, Tuple } from "effect"
import { type ChildProcess as Command, ChildProcessSpawner } from "effect/process"

const Hex = Schema.String.check(Schema.isPattern(/^(?:[a-fA-F0-9]{2})*$/))
export const StrictVerdict = Schema.Literals(["valid", "invalid-input", "nonmatch"])
export const PositiveInt = Schema.Int.check(Schema.isGreaterThan(0))

export const RsaPublicJwk = Schema.Struct({
  kty: Schema.Literal("RSA"),
  n: Schema.NonEmptyString,
  e: Schema.NonEmptyString
})

export class FixtureGenerationFailed extends Data.TaggedError("FixtureGenerationFailed")<{
  readonly operation: string
}> {}

export const requireExit = (command: Command.Command, expected: number, operation: string) =>
  Effect.gen(function*() {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const code = yield* spawner.exitCode(command)
    return yield* Effect.filterOrFail(
      Effect.succeed(code),
      (actual) => N.Equivalence(actual, expected),
      () => new FixtureGenerationFailed({ operation })
    )
  })

export const Ed25519Fixture = Schema.fromJsonString(
  Schema.Struct({
    schema: Schema.Literal("@scenesystems/sign ed25519 strict conformance v1"),
    cases: Schema.NonEmptyArray(
      Schema.Struct({
        id: Schema.NonEmptyString,
        publicKey: Hex,
        message: Hex,
        signature: Hex,
        strictVerdict: StrictVerdict
      })
    )
  })
)

export const P256Fixture = Schema.fromJsonString(
  Schema.Struct({
    schema: Schema.Literal("@scenesystems/sign P-256 SHA-256 P1363 low-S conformance v1"),
    cases: Schema.NonEmptyArray(
      Schema.Struct({
        tcId: PositiveInt,
        publicKey: Schema.Struct({ uncompressed: Hex }),
        message: Hex,
        signature: Hex,
        strictVerdict: StrictVerdict
      })
    )
  })
)

export const MlDsa65Fixture = Schema.fromJsonString(
  Schema.Struct({
    schema: Schema.Literal("@scenesystems/sign ML-DSA-65 pure external-interface conformance v1"),
    strictVerdicts: Schema.NonEmptyArray(
      Schema.Struct({
        tcId: PositiveInt,
        verdict: StrictVerdict
      })
    ),
    cases: Schema.NonEmptyArray(
      Schema.Struct({
        tgId: PositiveInt,
        tcId: PositiveInt,
        publicKey: Hex,
        message: Hex,
        signature: Hex,
        context: Hex,
        testPassed: Schema.Boolean
      })
    )
  })
)

export const PublicSignatureKatKeyPair = Schema.Struct({
  sourceId: Schema.NonEmptyString,
  parameterSet: Schema.NonEmptyString,
  entropy: Hex,
  publicKey: Hex,
  secretKey: Hex
})

export const PublicSignatureKatVerification = Schema.Struct({
  sourceId: Schema.NonEmptyString,
  publicKey: Hex,
  message: Hex,
  signature: Hex,
  expected: Schema.Boolean
})

const MlDsaKeyPair = PublicSignatureKatKeyPair
  .mapFields(Struct.omit(["parameterSet"]))
  .mapFields(Struct.assign({ parameterSet: Schema.Literals(["ML-DSA-44", "ML-DSA-87"]) }))
const SlhDsaKeyPair = PublicSignatureKatKeyPair
  .mapFields(Struct.omit(["parameterSet"]))
  .mapFields(Struct.assign({
    parameterSet: Schema.Literals([
      "SLH-DSA-SHA2-128s",
      "SLH-DSA-SHA2-128f",
      "SLH-DSA-SHA2-192f",
      "SLH-DSA-SHA2-256f"
    ])
  }))

export const PublicSignatureKat = Schema.Struct({
  schema: Schema.Literal("@scenesystems/sign public signature KAT conformance v1"),
  secp256k1: Schema.Struct({
    ecdsa: Schema.Tuple([PublicSignatureKatVerification, PublicSignatureKatVerification]),
    bip340: Schema.Tuple([
      Schema.Struct({
        sourceId: Schema.NonEmptyString,
        secretKey: Hex,
        publicKey: Hex,
        auxiliaryRandomness: Hex,
        message: Hex,
        signature: Hex,
        expected: Schema.Literal(true)
      }),
      PublicSignatureKatVerification
    ])
  }),
  mlDsa: Schema.Tuple([MlDsaKeyPair, MlDsaKeyPair]),
  slhDsa: Schema.Tuple([
    SlhDsaKeyPair,
    SlhDsaKeyPair,
    SlhDsaKeyPair,
    SlhDsaKeyPair
  ])
})

export const PublicSignatureKatFixture = Schema.fromJsonString(PublicSignatureKat, { space: 2 })

export const RsaWycheproofFixture = Schema.fromJsonString(Schema.Struct({
  testGroups: Schema.NonEmptyArray(Schema.Struct({
    keyJwk: RsaPublicJwk,
    tests: Schema.NonEmptyArray(Schema.Struct({
      tcId: PositiveInt,
      msg: Hex,
      sig: Hex,
      result: Schema.Literals(["valid", "invalid", "acceptable"])
    }))
  }))
}))

export const RsaOpenSslCase = Schema.Struct({
  name: Schema.NonEmptyString,
  message: Hex,
  signature: Hex,
  alteredMessage: Hex,
  alteredSignature: Hex
})

export const RsaOpenSslGroup = Schema.Struct({
  name: Schema.NonEmptyString,
  bits: PositiveInt,
  jwk: RsaPublicJwk,
  cases: Schema.NonEmptyArray(RsaOpenSslCase)
})

export const RsaOpenSsl = Schema.Struct({
  generator: Schema.NonEmptyString,
  groups: Schema.NonEmptyArray(RsaOpenSslGroup)
})

export const RsaOpenSslFixture = Schema.fromJsonString(RsaOpenSsl)

const Sha256Hex = Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/))
const Source = Schema.Struct({
  locator: Schema.String.check(Schema.isPattern(/^https:\/\//)),
  revision: Schema.NonEmptyString,
  path: Schema.NonEmptyString,
  selector: Schema.NonEmptyString
})

const VerdictRemap = Schema.Union([
  Schema.Struct({ caseIds: Schema.NonEmptyArray(Schema.NonEmptyString) }),
  Schema.Struct({ tcId: PositiveInt }),
  Schema.Struct({ tcIds: Schema.NonEmptyArray(PositiveInt) })
]).mapMembers(Tuple.map(Schema.fieldsAssign({
  upstreamResult: Schema.NonEmptyString,
  localVerdict: StrictVerdict,
  reason: Schema.NonEmptyString
})))

export const ConformancePayload = Schema.Struct({
  file: Schema.Literals([
    "ed25519.json",
    "p256.json",
    "ml-dsa-65.json",
    "sign-public-kat.json",
    "rsa-wycheproof.json",
    "rsa-openssl.json",
    "jwt-openssl.json",
    "jwt-access-openssl.json"
  ]),
  sha256: Sha256Hex,
  sources: Schema.NonEmptyArray(Source),
  licenseNotice: Schema.NonEmptyString,
  transformations: Schema.NonEmptyArray(Schema.NonEmptyString),
  exclusions: Schema.Array(Schema.NonEmptyString),
  localVerdictRemaps: Schema.Array(VerdictRemap)
})

export const ConformanceManifestData = Schema.Struct({
  schema: Schema.Literal("@scenesystems/sign conformance provenance manifest v1"),
  retrievalDate: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
  payloads: Schema.NonEmptyArray(ConformancePayload)
})

export const ConformanceManifest = Schema.fromJsonString(ConformanceManifestData, { space: 2 })

const fixturePath = (file: string) =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const script = yield* path.fromFileUrl(yield* Schema.decodeEffect(Schema.URLFromString)(import.meta.url))
    const root = path.resolve(path.dirname(script), "../test/fixtures/conformance")
    return path.join(root, file)
  })

export const readConformanceFixture = (file: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    return yield* fileSystem.readFileString(yield* fixturePath(file))
  })

export const readConformanceFixtureBytes = (file: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    return yield* fileSystem.readFile(yield* fixturePath(file))
  })

export const decodeConformanceFixture = <S extends Schema.Constraint>(file: string, schema: S) =>
  readConformanceFixture(file).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(schema))
  )
