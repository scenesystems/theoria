/** Checked-in conformance corpora, provenance, admission, and loading. */
import { FileSystem, Path, Url } from "@effect/platform"
import { Array as Arr, Effect, Match, type ParseResult, Schema, String as Str } from "effect"

export const root = "test/fixtures/external"
export const manifestFile = "sources.manifest.json"

const NonNegativeInt = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))
const Hex = Schema.String.pipe(Schema.pattern(/^(?:[a-f0-9]{2})*$/))
const Sha256Hex = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/))
const Blake3XofHex = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{262}$/))

export const Kind = Schema.Literal(
  "blake3",
  "hash",
  "hmac",
  "hkdf",
  "jcs",
  "unicode-adversarial"
)

export type Kind = typeof Kind.Type

const Exclusion = Schema.Struct({
  selector: Schema.NonEmptyString,
  reason: Schema.NonEmptyString
})

const VerdictRemap = Schema.Struct({
  selector: Schema.NonEmptyString,
  upstreamVerdict: Schema.NonEmptyString,
  localVerdict: Schema.NonEmptyString,
  reason: Schema.NonEmptyString
})

const Source = Schema.Struct({
  id: Schema.NonEmptyString,
  kind: Kind,
  fixturePath: Schema.NonEmptyString,
  origin: Schema.Literal("external", "local-adversarial"),
  sourceLocator: Schema.NonEmptyString,
  revision: Schema.NonEmptyString,
  sourcePaths: Schema.NonEmptyArray(Schema.NonEmptyString),
  sourceSelectors: Schema.NonEmptyArray(Schema.NonEmptyString),
  retrievedAt: Schema.String.pipe(Schema.pattern(/^\d{4}-\d{2}-\d{2}$/)),
  sourceLicense: Schema.NonEmptyString,
  licenseUrl: Schema.String.pipe(Schema.pattern(/^https:\/\//)),
  sourceNotice: Schema.NonEmptyString,
  transformations: Schema.Array(Schema.NonEmptyString),
  exclusions: Schema.Array(Exclusion),
  localVerdictRemaps: Schema.Array(VerdictRemap),
  contentSha256: Sha256Hex
})

export const Manifest = Schema.parseJson(
  Schema.Struct({
    sources: Schema.NonEmptyArray(Source)
  }),
  { space: 2 }
)

export type Manifest = typeof Manifest.Type

export const CanonicalJson = Schema.parseJson(
  Schema.Struct({
    format: Schema.Literal("jcs-cases-v1"),
    cases: Schema.NonEmptyArray(
      Schema.Struct({
        id: Schema.NonEmptyString,
        input: Schema.Unknown,
        expectedCanonical: Schema.String
      })
    )
  })
)

export const Blake3 = Schema.parseJson(
  Schema.Struct({
    _comment: Schema.NonEmptyString,
    key: Schema.Literal("whats the Elvish word for friend"),
    context_string: Schema.Literal("BLAKE3 2019-12-27 16:29:52 test vectors context"),
    cases: Schema.NonEmptyArray(
      Schema.Struct({
        input_len: NonNegativeInt,
        hash: Blake3XofHex,
        keyed_hash: Blake3XofHex,
        derive_key: Blake3XofHex
      })
    )
  })
)

export const Digest = Schema.parseJson(
  Schema.Struct({
    format: Schema.Literal("hash-cases-v1"),
    algorithm: Schema.Literal("sha256"),
    cases: Schema.NonEmptyArray(
      Schema.Struct({
        id: Schema.NonEmptyString,
        inputHex: Hex,
        expectedHex: Sha256Hex
      })
    )
  })
)

export const Hmac = Schema.parseJson(
  Schema.Struct({
    format: Schema.Literal("hmac-cases-v1"),
    algorithm: Schema.Literal("hmac-sha1", "hmac-sha256"),
    cases: Schema.NonEmptyArray(
      Schema.Struct({
        id: Schema.NonEmptyString,
        keyHex: Hex,
        messageHex: Hex,
        outputLength: PositiveInt,
        expectedHex: Hex
      })
    )
  })
)

const Rfc5869 = Schema.Struct({
  format: Schema.Literal("hkdf-cases-v1"),
  algorithm: Schema.Literal("hkdf-sha256"),
  cases: Schema.NonEmptyArray(
    Schema.Struct({
      id: Schema.NonEmptyString,
      ikmHex: Hex,
      saltHex: Schema.NullOr(Hex),
      infoHex: Hex,
      length: NonNegativeInt,
      expectedHex: Hex
    })
  )
})

const WycheproofNote = Schema.Struct({
  bugType: Schema.NonEmptyString,
  description: Schema.NonEmptyString,
  effect: Schema.optional(Schema.NonEmptyString)
})

const WycheproofHkdfCase = Schema.Struct({
  tcId: PositiveInt,
  comment: Schema.String,
  flags: Schema.Array(Schema.NonEmptyString),
  ikm: Hex,
  salt: Hex,
  info: Hex,
  size: NonNegativeInt,
  okm: Hex,
  result: Schema.Literal("valid", "invalid", "acceptable")
})

const WycheproofHkdf = Schema.Struct({
  algorithm: Schema.Literal("HKDF-SHA-512"),
  schema: Schema.Literal("hkdf_test_schema_v1.json"),
  numberOfTests: PositiveInt,
  header: Schema.NonEmptyArray(Schema.NonEmptyString),
  notes: Schema.Record({ key: Schema.NonEmptyString, value: WycheproofNote }),
  testGroups: Schema.NonEmptyArray(
    Schema.Struct({
      type: Schema.Literal("HkdfTest"),
      source: Schema.Struct({
        name: Schema.NonEmptyString,
        version: Schema.NonEmptyString
      }),
      keySize: PositiveInt,
      tests: Schema.NonEmptyArray(WycheproofHkdfCase)
    })
  )
})

export const Hkdf = Schema.parseJson(Schema.Union(Rfc5869, WycheproofHkdf))

export const UnicodeAdversarial = Schema.parseJson(
  Schema.Struct({
    format: Schema.Literal("unicode-adversarial-v1"),
    cases: Schema.NonEmptyArray(
      Schema.Struct({
        id: Schema.NonEmptyString,
        target: Schema.Literal("key", "value"),
        input: Schema.String,
        expectedTag: Schema.Literal("InvalidUnicode"),
        expectedCodeUnitIndex: NonNegativeInt
      })
    )
  })
)

export const validate = (kind: Kind, content: string): Effect.Effect<void, ParseResult.ParseError> =>
  Match.value(kind).pipe(
    Match.when(
      "blake3",
      () => Schema.decodeUnknown(Blake3)(content, { onExcessProperty: "error" }).pipe(Effect.asVoid)
    ),
    Match.when(
      "jcs",
      () => Schema.decodeUnknown(CanonicalJson)(content, { onExcessProperty: "error" }).pipe(Effect.asVoid)
    ),
    Match.when("hash", () => Schema.decodeUnknown(Digest)(content, { onExcessProperty: "error" }).pipe(Effect.asVoid)),
    Match.when("hmac", () => Schema.decodeUnknown(Hmac)(content, { onExcessProperty: "error" }).pipe(Effect.asVoid)),
    Match.when("hkdf", () => Schema.decodeUnknown(Hkdf)(content, { onExcessProperty: "error" }).pipe(Effect.asVoid)),
    Match.when(
      "unicode-adversarial",
      () => Schema.decodeUnknown(UnicodeAdversarial)(content, { onExcessProperty: "error" }).pipe(Effect.asVoid)
    ),
    Match.exhaustive
  )

const resolveRoot: Effect.Effect<string, never, Path.Path> = Effect.gen(function*() {
  const path = yield* Path.Path
  return yield* path.fromFileUrl(yield* Url.fromString(`../${root}/`, import.meta.url))
}).pipe(Effect.orDie)

export const read = (relativePath: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const absoluteRoot = yield* resolveRoot
    return yield* fileSystem.readFileString(path.join(absoluteRoot, relativePath))
  })

export const loadManifest = read(manifestFile).pipe(Effect.flatMap(Schema.decodeUnknown(Manifest)))

export const sourcesOfKind = (manifest: Manifest, kind: Kind) =>
  Arr.filter(manifest.sources, (source) => Str.Equivalence(source.kind, kind))
