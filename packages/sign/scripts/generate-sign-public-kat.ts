/**
 * Reproduces the compact public-signature KAT fixture from pinned upstream
 * BIP-340, Wycheproof, and NIST ACVP sources, then updates its manifest digest.
 *
 * Usage: bun run scripts/generate-sign-public-kat.ts
 */
import { FetchHttpClient, FileSystem, HttpClient, HttpClientResponse, Path, Url } from "@effect/platform"
import * as BunContext from "@effect/platform-bun/BunContext"
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import { digestBytesHex } from "@scenesystems/digest"
import { Array as Arr, Boolean as B, Effect, Layer, Number as N, Option, Schema, String as Str, Struct } from "effect"
import {
  ConformanceManifest,
  ConformanceManifestData,
  ConformancePayload,
  FixtureGenerationFailed,
  PositiveInt,
  PublicSignatureKat,
  PublicSignatureKatFixture,
  PublicSignatureKatKeyPair,
  PublicSignatureKatVerification,
  readConformanceFixtureBytes
} from "./fixture-contract.js"

const acvpRevision = "112690e8484dba7077709a05b1f3af58ddefdd5d"
const bipRevision = "173f386dfb8b4f1c4b16d69190a753802802ac4d"
const wycheproofRevision = "e0df04e0c033f2d25c5051dd06230336c7822358"
const rawGitHub = "https://raw.githubusercontent.com/"

const pinnedUrl = (repository: string, revision: string, path: string) =>
  Arr.join(Arr.make(rawGitHub, repository, "/", revision, "/", path), "")

const mlPromptUrl = pinnedUrl(
  "usnistgov/ACVP-Server",
  acvpRevision,
  "gen-val/json-files/ML-DSA-keyGen-FIPS204/prompt.json"
)
const mlResultsUrl = pinnedUrl(
  "usnistgov/ACVP-Server",
  acvpRevision,
  "gen-val/json-files/ML-DSA-keyGen-FIPS204/expectedResults.json"
)
const slhPromptUrl = pinnedUrl(
  "usnistgov/ACVP-Server",
  acvpRevision,
  "gen-val/json-files/SLH-DSA-keyGen-FIPS205/prompt.json"
)
const slhResultsUrl = pinnedUrl(
  "usnistgov/ACVP-Server",
  acvpRevision,
  "gen-val/json-files/SLH-DSA-keyGen-FIPS205/expectedResults.json"
)
const bipUrl = pinnedUrl("bitcoin/bips", bipRevision, "bip-0340/test-vectors.csv")
const ecdsaUrl = pinnedUrl(
  "C2SP/wycheproof",
  wycheproofRevision,
  "testvectors_v1/ecdsa_secp256k1_sha256_p1363_test.json"
)

const MlPrompt = Schema.Struct({
  testGroups: Schema.Array(Schema.Struct({
    tgId: PositiveInt,
    parameterSet: Schema.NonEmptyString,
    tests: Schema.NonEmptyArray(Schema.Struct({ tcId: PositiveInt, seed: Schema.NonEmptyString }))
  }))
})

const SlhPrompt = Schema.Struct({
  testGroups: Schema.Array(Schema.Struct({
    tgId: PositiveInt,
    parameterSet: Schema.NonEmptyString,
    tests: Schema.NonEmptyArray(Schema.Struct({
      tcId: PositiveInt,
      skSeed: Schema.NonEmptyString,
      skPrf: Schema.NonEmptyString,
      pkSeed: Schema.NonEmptyString
    }))
  }))
})

const KeyResults = Schema.Struct({
  testGroups: Schema.Array(Schema.Struct({
    tgId: PositiveInt,
    tests: Schema.NonEmptyArray(Schema.Struct({
      tcId: PositiveInt,
      pk: Schema.NonEmptyString,
      sk: Schema.NonEmptyString
    }))
  }))
})

const EcdsaCorpus = Schema.Struct({
  testGroups: Schema.Array(Schema.Struct({
    publicKey: Schema.Struct({ uncompressed: Schema.NonEmptyString }),
    tests: Schema.Array(Schema.Struct({
      tcId: PositiveInt,
      msg: Schema.String,
      sig: Schema.NonEmptyString,
      result: Schema.Literal("valid", "invalid", "acceptable")
    }))
  }))
})

const SelectedBipRow = Schema.Struct({
  secretKey: Schema.String,
  publicKey: Schema.NonEmptyString,
  auxiliaryRandomness: Schema.String,
  message: Schema.String,
  signature: Schema.NonEmptyString,
  verificationResult: Schema.Literal("TRUE", "FALSE")
})

const fetchResponse = (url: string) => HttpClient.get(url).pipe(Effect.flatMap(HttpClientResponse.filterStatusOk))

const fetchJson = <A, I>(url: string, schema: Schema.Schema<A, I>) =>
  fetchResponse(url).pipe(
    Effect.flatMap((response) => response.json),
    Effect.flatMap(Schema.decodeUnknown(schema))
  )

const fetchText = (url: string) => fetchResponse(url).pipe(Effect.flatMap((response) => response.text))

const required = <A>(value: Option.Option<A>, operation: string) =>
  Option.match(value, {
    onNone: () => Effect.fail(new FixtureGenerationFailed({ operation })),
    onSome: Effect.succeed
  })

const firstTest = <A>(tests: Iterable<A>) => required(Arr.head(Arr.fromIterable(tests)), "find ACVP test")

const mlKeyPair = (
  prompt: typeof MlPrompt.Type,
  results: typeof KeyResults.Type,
  tgId: number
) =>
  Effect.gen(function*() {
    const promptGroup = yield* required(
      Arr.findFirst(prompt.testGroups, (group) => N.Equivalence(group.tgId, tgId)),
      "find ML-DSA ACVP prompt group"
    )
    const resultGroup = yield* required(
      Arr.findFirst(results.testGroups, (group) => N.Equivalence(group.tgId, tgId)),
      "find ML-DSA ACVP result group"
    )
    const input = yield* firstTest(promptGroup.tests)
    const output = yield* required(
      Arr.findFirst(resultGroup.tests, (test) => N.Equivalence(test.tcId, input.tcId)),
      "join ML-DSA ACVP result by tcId"
    )
    const sourceId = Arr.join(
      Arr.make(
        "acvp-tgId-",
        yield* Schema.encode(Schema.NumberFromString)(tgId),
        "-tcId-",
        yield* Schema.encode(
          Schema.NumberFromString
        )(input.tcId)
      ),
      ""
    )
    return PublicSignatureKatKeyPair.make({
      sourceId,
      parameterSet: promptGroup.parameterSet,
      entropy: input.seed,
      publicKey: output.pk,
      secretKey: output.sk
    })
  })

const slhKeyPair = (
  prompt: typeof SlhPrompt.Type,
  results: typeof KeyResults.Type,
  tgId: number
) =>
  Effect.gen(function*() {
    const promptGroup = yield* required(
      Arr.findFirst(prompt.testGroups, (group) => N.Equivalence(group.tgId, tgId)),
      "find SLH-DSA ACVP prompt group"
    )
    const resultGroup = yield* required(
      Arr.findFirst(results.testGroups, (group) => N.Equivalence(group.tgId, tgId)),
      "find SLH-DSA ACVP result group"
    )
    const input = yield* firstTest(promptGroup.tests)
    const output = yield* required(
      Arr.findFirst(resultGroup.tests, (test) => N.Equivalence(test.tcId, input.tcId)),
      "join SLH-DSA ACVP result by tcId"
    )
    const sourceId = Arr.join(
      Arr.make(
        "acvp-tgId-",
        yield* Schema.encode(Schema.NumberFromString)(tgId),
        "-tcId-",
        yield* Schema.encode(
          Schema.NumberFromString
        )(input.tcId)
      ),
      ""
    )
    return PublicSignatureKatKeyPair.make({
      sourceId,
      parameterSet: promptGroup.parameterSet,
      entropy: Arr.join(Arr.make(input.skSeed, input.skPrf, input.pkSeed), ""),
      publicKey: output.pk,
      secretKey: output.sk
    })
  })

const ecdsaCase = (corpus: typeof EcdsaCorpus.Type, tcId: number) =>
  Effect.gen(function*() {
    const group = yield* required(
      Arr.findFirst(corpus.testGroups, (candidate) =>
        Arr.some(candidate.tests, (test) => N.Equivalence(test.tcId, tcId))),
      "find Wycheproof group"
    )
    const test = yield* required(
      Arr.findFirst(group.tests, (candidate) =>
        N.Equivalence(candidate.tcId, tcId)),
      "find Wycheproof test"
    )
    return PublicSignatureKatVerification.make({
      sourceId: Str.concat("wycheproof-tcId-", yield* Schema.encode(Schema.NumberFromString)(tcId)),
      publicKey: group.publicKey.uncompressed,
      message: test.msg,
      signature: test.sig,
      expected: Str.Equivalence(test.result, "valid")
    })
  })

const bipRow = (csv: string, index: number) =>
  Effect.gen(function*() {
    const prefix = Str.concat(yield* Schema.encode(Schema.NumberFromString)(index), ",")
    const row = yield* required(
      Arr.findFirst(Str.split(/\r?\n/)(csv), Str.startsWith(prefix)),
      "find BIP-340 row"
    )
    const columns = Str.split(",")(row)
    const column = (position: number) => required(Arr.get(columns, position), "read BIP-340 column")
    return yield* Schema.decodeUnknown(SelectedBipRow)({
      secretKey: yield* column(1),
      publicKey: yield* column(2),
      auxiliaryRandomness: yield* column(3),
      message: yield* column(4),
      signature: yield* column(5),
      verificationResult: yield* column(6)
    })
  })

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const mlPrompt = yield* fetchJson(mlPromptUrl, MlPrompt)
  const mlResults = yield* fetchJson(mlResultsUrl, KeyResults)
  const slhPrompt = yield* fetchJson(slhPromptUrl, SlhPrompt)
  const slhResults = yield* fetchJson(slhResultsUrl, KeyResults)
  const ecdsa = yield* fetchJson(ecdsaUrl, EcdsaCorpus)
  const bip = yield* fetchText(bipUrl)
  const bipPositive = yield* bipRow(bip, 0)
  const bipNegative = yield* bipRow(bip, 7)

  const fixture = yield* Schema.decodeUnknown(PublicSignatureKat)({
    schema: "@scenesystems/sign public signature KAT conformance v1",
    secp256k1: {
      ecdsa: Arr.make(yield* ecdsaCase(ecdsa, 60), yield* ecdsaCase(ecdsa, 4)),
      bip340: Arr.make(
        {
          sourceId: "bip340-index-0",
          secretKey: bipPositive.secretKey,
          publicKey: bipPositive.publicKey,
          auxiliaryRandomness: bipPositive.auxiliaryRandomness,
          message: bipPositive.message,
          signature: bipPositive.signature,
          expected: Str.Equivalence(bipPositive.verificationResult, "TRUE")
        },
        {
          sourceId: "bip340-index-7",
          publicKey: bipNegative.publicKey,
          message: bipNegative.message,
          signature: bipNegative.signature,
          expected: Str.Equivalence(bipNegative.verificationResult, "TRUE")
        }
      )
    },
    mlDsa: Arr.make(yield* mlKeyPair(mlPrompt, mlResults, 1), yield* mlKeyPair(mlPrompt, mlResults, 3)),
    slhDsa: Arr.make(
      yield* slhKeyPair(slhPrompt, slhResults, 1),
      yield* slhKeyPair(slhPrompt, slhResults, 3),
      yield* slhKeyPair(slhPrompt, slhResults, 7),
      yield* slhKeyPair(slhPrompt, slhResults, 11)
    )
  })
  const root = yield* path.fromFileUrl(yield* Url.fromString("../test/fixtures/conformance/", import.meta.url))
  yield* fileSystem.writeFileString(
    path.join(root, "sign-public-kat.json"),
    Str.concat(yield* Schema.encode(PublicSignatureKatFixture)(fixture), "\n")
  )
  const sha256 = yield* readConformanceFixtureBytes("sign-public-kat.json").pipe(
    Effect.flatMap((bytes) => digestBytesHex("sha256", bytes))
  )
  const manifest = yield* fileSystem.readFileString(path.join(root, "sources.manifest.json")).pipe(
    Effect.flatMap(Schema.decode(ConformanceManifest))
  )
  const payloads = Arr.map(
    manifest.payloads,
    (payload) =>
      B.match(Str.Equivalence(payload.file, "sign-public-kat.json"), {
        onFalse: () => payload,
        onTrue: () => ConformancePayload.make(Struct.evolve(payload, { sha256: () => sha256 }))
      })
  )
  const updated = ConformanceManifestData.make(Struct.evolve(manifest, { payloads: () => payloads }))
  yield* fileSystem.writeFileString(
    path.join(root, "sources.manifest.json"),
    Str.concat(yield* Schema.encode(ConformanceManifest)(updated), "\n")
  )
}).pipe(Effect.provide(Layer.merge(FetchHttpClient.layer, BunContext.layer)))

BunRuntime.runMain(program)
