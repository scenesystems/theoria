import { Schema } from "effect"

const NonNegativeIntSchema = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
const PositiveIntSchema = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))
const HexSchema = Schema.String.pipe(Schema.pattern(/^(?:[a-f0-9]{2})*$/))
const Sha256HexSchema = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/))
const Blake3XofHexSchema = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{262}$/))

export const FixtureKindSchema = Schema.Literal(
  "blake3",
  "hash",
  "hmac",
  "hkdf",
  "jcs",
  "unicode-adversarial"
)

export const FixtureExclusionSchema = Schema.Struct({
  selector: Schema.NonEmptyString,
  reason: Schema.NonEmptyString
})

export const FixtureVerdictRemapSchema = Schema.Struct({
  selector: Schema.NonEmptyString,
  upstreamVerdict: Schema.NonEmptyString,
  localVerdict: Schema.NonEmptyString,
  reason: Schema.NonEmptyString
})

export const FixtureSourceSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  kind: FixtureKindSchema,
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
  exclusions: Schema.Array(FixtureExclusionSchema),
  localVerdictRemaps: Schema.Array(FixtureVerdictRemapSchema),
  contentSha256: Sha256HexSchema
})

export const FixtureManifestSchema = Schema.parseJson(
  Schema.Struct({
    sources: Schema.NonEmptyArray(FixtureSourceSchema)
  }),
  { space: 2 }
)

export const JcsFixtureSchema = Schema.parseJson(
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

export const Blake3FixtureSchema = Schema.parseJson(
  Schema.Struct({
    _comment: Schema.NonEmptyString,
    key: Schema.Literal("whats the Elvish word for friend"),
    context_string: Schema.Literal("BLAKE3 2019-12-27 16:29:52 test vectors context"),
    cases: Schema.NonEmptyArray(
      Schema.Struct({
        input_len: NonNegativeIntSchema,
        hash: Blake3XofHexSchema,
        keyed_hash: Blake3XofHexSchema,
        derive_key: Blake3XofHexSchema
      })
    )
  })
)

export const HashFixtureSchema = Schema.parseJson(
  Schema.Struct({
    format: Schema.Literal("hash-cases-v1"),
    algorithm: Schema.Literal("sha256"),
    cases: Schema.NonEmptyArray(
      Schema.Struct({
        id: Schema.NonEmptyString,
        inputHex: HexSchema,
        expectedHex: Sha256HexSchema
      })
    )
  })
)

export const HmacFixtureSchema = Schema.parseJson(
  Schema.Struct({
    format: Schema.Literal("hmac-cases-v1"),
    algorithm: Schema.Literal("hmac-sha1", "hmac-sha256"),
    cases: Schema.NonEmptyArray(
      Schema.Struct({
        id: Schema.NonEmptyString,
        keyHex: HexSchema,
        messageHex: HexSchema,
        outputLength: PositiveIntSchema,
        expectedHex: HexSchema
      })
    )
  })
)

export const HkdfFixtureSchema = Schema.Struct({
  format: Schema.Literal("hkdf-cases-v1"),
  algorithm: Schema.Literal("hkdf-sha256"),
  cases: Schema.NonEmptyArray(
    Schema.Struct({
      id: Schema.NonEmptyString,
      ikmHex: HexSchema,
      saltHex: Schema.NullOr(HexSchema),
      infoHex: HexSchema,
      length: NonNegativeIntSchema,
      expectedHex: HexSchema
    })
  )
})

const WycheproofNoteSchema = Schema.Struct({
  bugType: Schema.NonEmptyString,
  description: Schema.NonEmptyString,
  effect: Schema.optional(Schema.NonEmptyString)
})

const WycheproofHkdfCaseSchema = Schema.Struct({
  tcId: PositiveIntSchema,
  comment: Schema.String,
  flags: Schema.Array(Schema.NonEmptyString),
  ikm: HexSchema,
  salt: HexSchema,
  info: HexSchema,
  size: NonNegativeIntSchema,
  okm: HexSchema,
  result: Schema.Literal("valid", "invalid", "acceptable")
})

export const WycheproofHkdfFixtureSchema = Schema.Struct({
  algorithm: Schema.Literal("HKDF-SHA-512"),
  schema: Schema.Literal("hkdf_test_schema_v1.json"),
  numberOfTests: PositiveIntSchema,
  header: Schema.NonEmptyArray(Schema.NonEmptyString),
  notes: Schema.Record({ key: Schema.NonEmptyString, value: WycheproofNoteSchema }),
  testGroups: Schema.NonEmptyArray(
    Schema.Struct({
      type: Schema.Literal("HkdfTest"),
      source: Schema.Struct({
        name: Schema.NonEmptyString,
        version: Schema.NonEmptyString
      }),
      keySize: PositiveIntSchema,
      tests: Schema.NonEmptyArray(WycheproofHkdfCaseSchema)
    })
  )
})

export const HkdfCorpusFixtureSchema = Schema.parseJson(Schema.Union(HkdfFixtureSchema, WycheproofHkdfFixtureSchema))

export const UnicodeAdversarialFixtureSchema = Schema.parseJson(
  Schema.Struct({
    format: Schema.Literal("unicode-adversarial-v1"),
    cases: Schema.NonEmptyArray(
      Schema.Struct({
        id: Schema.NonEmptyString,
        target: Schema.Literal("key", "value"),
        input: Schema.String,
        expectedTag: Schema.Literal("InvalidUnicode"),
        expectedCodeUnitIndex: NonNegativeIntSchema
      })
    )
  })
)

export type FixtureKind = Schema.Schema.Type<typeof FixtureKindSchema>
