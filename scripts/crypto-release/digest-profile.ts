import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Effect, Option, Order, Record, Schema } from "effect"
import * as ts from "typescript"

import {
  Blake3FixtureSchema,
  FixtureManifestSchema,
  HashFixtureSchema,
  HkdfCorpusFixtureSchema,
  HmacFixtureSchema,
  JcsFixtureSchema,
  UnicodeAdversarialFixtureSchema
} from "../../packages/digest/scripts/fixture-schemas.js"
import { DigestKatProfile, type DigestKatProfile as DigestKatProfileType } from "./digest-schema.js"
import { CryptoReleaseCheckError, readSha256Hex, runCommand } from "./shared.js"

const PACKAGE_NAME = "@scenesystems/digest"
const NOBLE_VERSION = "2.0.1"
const NOBLE_SRI = "sha512-XlOlEbQcE9fmuXxrVTXCTlG2nlRXa9Rj3rr5Ue/+tX+nmkgbX720YHh0VR3hBF9xDvwnb8D2shVGOwNx+ulArw=="
const NOBLE_REPOSITORY = "https://github.com/paulmillr/noble-hashes.git"
const NOBLE_REVISION = "d30e0707258f4cf0d4fb5dd6062436f8c1e997eb"

const DigestManifest = Schema.parseJson(
  Schema.Struct({
    name: Schema.Literal(PACKAGE_NAME),
    dependencies: Schema.Struct({ "@noble/hashes": Schema.Literal(NOBLE_VERSION) })
  })
)

const BunLock = Schema.Struct({
  packages: Schema.Record({ key: Schema.String, value: Schema.Unknown })
})

const NobleLockEntry = Schema.Tuple(
  Schema.Literal(`@noble/hashes@${NOBLE_VERSION}`),
  Schema.String,
  Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  Schema.Literal(NOBLE_SRI)
)

const ReleaseSnapshot = Schema.parseJson(
  Schema.Struct({
    packageName: Schema.Literal(PACKAGE_NAME),
    releasedVersion: Schema.Literal("0.3.0"),
    exports: Schema.NonEmptyArray(
      Schema.Struct({
        subpath: Schema.Literal("."),
        exportName: Schema.NonEmptyString,
        kind: Schema.Literal("value", "type"),
        firstReleasedIn: Schema.NonEmptyString
      })
    )
  })
)

const profileError = (stage: string, detail: string): CryptoReleaseCheckError =>
  new CryptoReleaseCheckError({ stage, detail })

const requireOption = <A>(
  value: Option.Option<A>,
  stage: string,
  detail: string
): Effect.Effect<A, CryptoReleaseCheckError> =>
  Option.match(value, {
    onNone: () => Effect.fail(profileError(stage, detail)),
    onSome: Effect.succeed
  })

const decodeFile = <A, I>(
  filePath: string,
  schema: Schema.Schema<A, I>
): Effect.Effect<A, CryptoReleaseCheckError, FileSystem.FileSystem> =>
  FileSystem.FileSystem.pipe(
    Effect.flatMap((fileSystem) => fileSystem.readFileString(filePath)),
    Effect.flatMap(Schema.decodeUnknown(schema)),
    Effect.mapError(() => profileError("decode-digest-evidence", filePath))
  )

const loadLockProvider = (root: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    yield* decodeFile(path.join(root, "packages/digest/package.json"), DigestManifest)
    const lockContent = yield* fileSystem.readFileString(path.join(root, "bun.lock")).pipe(
      Effect.mapError(() => profileError("read-lockfile", "bun.lock"))
    )
    const parsed = ts.parseConfigFileTextToJson("bun.lock", lockContent)
    yield* Option.match(Option.fromNullable(parsed.error), {
      onNone: () => Effect.void,
      onSome: () => Effect.fail(profileError("parse-lockfile", "bun.lock is not valid JSONC"))
    })
    const lock = yield* Schema.decodeUnknown(BunLock)(parsed.config).pipe(
      Effect.mapError(() => profileError("decode-lockfile", "bun.lock packages map"))
    )
    const nobleEntry = yield* requireOption(
      Record.get(lock.packages, "@noble/hashes"),
      "provider-lock-entry",
      "@noble/hashes"
    )
    yield* Schema.decodeUnknown(NobleLockEntry)(nobleEntry).pipe(
      Effect.mapError(() => profileError("provider-lock-entry", "@noble/hashes version or SRI drifted"))
    )
    const remoteTags = yield* runCommand(
      "provider-source-revision",
      root,
      "git",
      ["ls-remote", NOBLE_REPOSITORY, `refs/tags/${NOBLE_VERSION}*`]
    )
    const revisionPinned = Arr.some(
      remoteTags.split("\n"),
      (line) => line === `${NOBLE_REVISION}\trefs/tags/${NOBLE_VERSION}^{}`
    )
    if (!revisionPinned) {
      return yield* Effect.fail(profileError("provider-source-revision", "noble-hashes tag revision drifted"))
    }

    return {
      name: "@noble/hashes",
      version: NOBLE_VERSION,
      npmSri: NOBLE_SRI,
      sourceRepository: NOBLE_REPOSITORY,
      sourceRevision: NOBLE_REVISION
    }
  })

const sourceById = (
  manifest: Schema.Schema.Type<typeof FixtureManifestSchema>,
  id: string
) => requireOption(Arr.findFirst(manifest.sources, (source) => source.id === id), "fixture-source", id)

const fixtureBySource = <A, I>(
  fixtureRoot: string,
  source: Schema.Schema.Type<typeof FixtureManifestSchema>["sources"][number],
  schema: Schema.Schema<A, I>
) => decodeFile(`${fixtureRoot}/${source.fixturePath}`, schema)

const caseById = <A extends { readonly id: string }>(cases: ReadonlyArray<A>, id: string) =>
  requireOption(Arr.findFirst(cases, (entry) => entry.id === id), "runtime-kat", id)

const loadRuntimeKats = (
  fixtureRoot: string,
  manifest: Schema.Schema.Type<typeof FixtureManifestSchema>
): Effect.Effect<DigestKatProfileType, CryptoReleaseCheckError, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const blakeSource = yield* sourceById(manifest, "blake3-official-vectors")
    const shaSource = yield* sourceById(manifest, "nist-cavp-sha256-short-message")
    const hmacSha1Source = yield* sourceById(manifest, "rfc2202-hmac-sha1")
    const hmacSha256Source = yield* sourceById(manifest, "rfc4231-hmac-sha256")
    const hkdfSha256Source = yield* sourceById(manifest, "rfc5869-hkdf-sha256")
    const hkdfSha512Source = yield* sourceById(manifest, "wycheproof-hkdf-sha512")
    const rfcJcsSource = yield* sourceById(manifest, "rfc8785-canonicalization")
    const cyberphoneSource = yield* sourceById(manifest, "cyberphone-jcs-corpus")
    const unicodeSource = yield* sourceById(manifest, "local-malformed-unicode-adversarial")

    const blake = yield* fixtureBySource(fixtureRoot, blakeSource, Blake3FixtureSchema)
    const sha = yield* fixtureBySource(fixtureRoot, shaSource, HashFixtureSchema)
    const hmacSha1 = yield* fixtureBySource(fixtureRoot, hmacSha1Source, HmacFixtureSchema)
    const hmacSha256 = yield* fixtureBySource(fixtureRoot, hmacSha256Source, HmacFixtureSchema)
    const hkdfSha256 = yield* fixtureBySource(fixtureRoot, hkdfSha256Source, HkdfCorpusFixtureSchema)
    const hkdfSha512 = yield* fixtureBySource(fixtureRoot, hkdfSha512Source, HkdfCorpusFixtureSchema)
    const rfcJcs = yield* fixtureBySource(fixtureRoot, rfcJcsSource, JcsFixtureSchema)
    const cyberphone = yield* fixtureBySource(fixtureRoot, cyberphoneSource, JcsFixtureSchema)
    const unicode = yield* fixtureBySource(fixtureRoot, unicodeSource, UnicodeAdversarialFixtureSchema)

    const blakeCase = yield* requireOption(
      Arr.findFirst(blake.cases, (entry) => entry.input_len === 0),
      "runtime-kat",
      "blake3:0"
    )
    const shaCase = yield* caseById(sha.cases, "nist-cavp-sha256-short-message:0")
    const hmacSha1Case = yield* caseById(hmacSha1.cases, "rfc2202:hmac-sha1:1")
    const hmacSha256Case = yield* caseById(hmacSha256.cases, "rfc4231:hmac-sha256:1")
    const hkdfSha256Case = hkdfSha256.algorithm === "hkdf-sha256"
      ? yield* caseById(hkdfSha256.cases, "rfc5869:hkdf-sha256:1")
      : yield* Effect.fail(profileError("runtime-kat", "rfc5869 algorithm"))
    const wycheproofCases = hkdfSha512.algorithm === "HKDF-SHA-512"
      ? Arr.flatMap(hkdfSha512.testGroups, (group) => group.tests)
      : []
    const hkdfSha512Case = yield* requireOption(
      Arr.findFirst(wycheproofCases, (entry) => entry.tcId === 1 && entry.result === "valid"),
      "runtime-kat",
      "wycheproof:hkdf-sha512:1"
    )
    const rfcJcsCase = yield* caseById(rfcJcs.cases, "rfc8785:section-3.2.3-property-sort")
    const cyberphoneCase = yield* caseById(cyberphone.cases, "cyberphone-jcs-corpus:unicode")
    const unicodeValueCase = yield* caseById(unicode.cases, "local-malformed-unicode:lone-lead-value")
    const unicodeKeyCase = yield* caseById(unicode.cases, "local-malformed-unicode:lone-trail-key")

    return yield* Schema.decodeUnknown(DigestKatProfile)({
      format: "digest-packed-runtime-kats-v1",
      cases: [
        {
          _tag: "Blake3Hash",
          id: "blake3:0:hash",
          sourceId: blakeSource.id,
          inputLength: 0,
          expectedHex: blakeCase.hash.slice(0, 64)
        },
        {
          _tag: "Blake3Mac",
          id: "blake3:0:keyed_hash",
          sourceId: blakeSource.id,
          inputLength: 0,
          key: blake.key,
          expectedHex: blakeCase.keyed_hash.slice(0, 64)
        },
        {
          _tag: "Blake3DeriveKey",
          id: "blake3:0:derive_key",
          sourceId: blakeSource.id,
          inputLength: 0,
          context: blake.context_string,
          expectedHex: blakeCase.derive_key.slice(0, 64)
        },
        {
          _tag: "Sha256",
          id: shaCase.id,
          sourceId: shaSource.id,
          inputHex: shaCase.inputHex,
          expectedHex: shaCase.expectedHex
        },
        {
          _tag: "Hmac",
          id: hmacSha1Case.id,
          sourceId: hmacSha1Source.id,
          algorithm: "hmac-sha1",
          keyHex: hmacSha1Case.keyHex,
          messageHex: hmacSha1Case.messageHex,
          outputLength: hmacSha1Case.outputLength,
          expectedHex: hmacSha1Case.expectedHex
        },
        {
          _tag: "Hmac",
          id: hmacSha256Case.id,
          sourceId: hmacSha256Source.id,
          algorithm: "hmac-sha256",
          keyHex: hmacSha256Case.keyHex,
          messageHex: hmacSha256Case.messageHex,
          outputLength: hmacSha256Case.outputLength,
          expectedHex: hmacSha256Case.expectedHex
        },
        {
          _tag: "Hkdf",
          id: hkdfSha256Case.id,
          sourceId: hkdfSha256Source.id,
          algorithm: "hkdf-sha256",
          ikmHex: hkdfSha256Case.ikmHex,
          saltHex: hkdfSha256Case.saltHex,
          infoHex: hkdfSha256Case.infoHex,
          outputLength: hkdfSha256Case.length,
          expectedHex: hkdfSha256Case.expectedHex
        },
        {
          _tag: "Hkdf",
          id: "wycheproof:hkdf-sha512:1",
          sourceId: hkdfSha512Source.id,
          algorithm: "hkdf-sha512",
          ikmHex: hkdfSha512Case.ikm,
          saltHex: hkdfSha512Case.salt,
          infoHex: hkdfSha512Case.info,
          outputLength: hkdfSha512Case.size,
          expectedHex: hkdfSha512Case.okm
        },
        {
          _tag: "Jcs",
          id: rfcJcsCase.id,
          sourceId: rfcJcsSource.id,
          input: rfcJcsCase.input,
          expectedCanonical: rfcJcsCase.expectedCanonical
        },
        {
          _tag: "Jcs",
          id: cyberphoneCase.id,
          sourceId: cyberphoneSource.id,
          input: cyberphoneCase.input,
          expectedCanonical: cyberphoneCase.expectedCanonical
        },
        {
          _tag: "InvalidUnicode",
          id: unicodeValueCase.id,
          sourceId: unicodeSource.id,
          target: unicodeValueCase.target,
          input: unicodeValueCase.input,
          expectedKind: "lone-high-surrogate",
          expectedCodeUnitIndex: unicodeValueCase.expectedCodeUnitIndex
        },
        {
          _tag: "InvalidUnicode",
          id: unicodeKeyCase.id,
          sourceId: unicodeSource.id,
          target: unicodeKeyCase.target,
          input: unicodeKeyCase.input,
          expectedKind: "lone-low-surrogate",
          expectedCodeUnitIndex: unicodeKeyCase.expectedCodeUnitIndex
        }
      ]
    }).pipe(Effect.mapError(() => profileError("runtime-kat", "constructed digest KAT profile")))
  })

export const loadDigestReleaseProfile = (root: string) =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const fixtureRoot = path.join(root, "packages/digest/test/fixtures/external")
    const manifest = yield* decodeFile(path.join(fixtureRoot, "sources.manifest.json"), FixtureManifestSchema)
    const fixtures = yield* Effect.forEach(manifest.sources, (source) =>
      Effect.gen(function*() {
        const contentSha256 = yield* readSha256Hex(path.join(fixtureRoot, source.fixturePath))
        if (contentSha256 !== source.contentSha256) {
          return yield* Effect.fail(profileError("fixture-hash", source.id))
        }
        return { id: source.id, revision: source.revision, fixturePath: source.fixturePath, contentSha256 }
      }))
    const kats = yield* loadRuntimeKats(fixtureRoot, manifest)
    const provider = yield* loadLockProvider(root)
    const snapshot = yield* decodeFile(
      path.join(root, "packages/digest/test/package/release-snapshots/0.3.0.json"),
      ReleaseSnapshot
    )

    return {
      packageName: PACKAGE_NAME,
      packageDirectory: path.join(root, "packages/digest"),
      provider,
      fixtures,
      kats,
      expectedExports: Arr.sort(
        Arr.map(Arr.filter(snapshot.exports, (entry) => entry.kind === "value"), (entry) => entry.exportName),
        Order.string
      )
    }
  })
