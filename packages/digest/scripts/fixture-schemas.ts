import { Schema } from "effect"

export const FixtureKindSchema = Schema.Literal("jcs", "hash", "hmac-hkdf", "parity-runtime")

export const FixtureSourceSchema = Schema.Struct({
  id: Schema.String,
  kind: FixtureKindSchema,
  fixturePath: Schema.String,
  sourceUrl: Schema.String.pipe(Schema.pattern(/^https:\/\//)),
  revision: Schema.String,
  retrievedAt: Schema.String,
  sourceLicense: Schema.String,
  normalizationNotes: Schema.String,
  contentSha256: Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/))
})

export const FixtureManifestSchema = Schema.parseJson(
  Schema.Struct({
    sources: Schema.NonEmptyArray(FixtureSourceSchema)
  })
)

export const JcsFixtureSchema = Schema.parseJson(
  Schema.Struct({
    id: Schema.String,
    input: Schema.Unknown,
    expectedCanonical: Schema.String
  })
)

export const HashFixtureSchema = Schema.parseJson(
  Schema.Struct({
    id: Schema.String,
    algorithm: Schema.Literal("blake3-256", "sha256"),
    inputUtf8: Schema.String,
    expectedHex: Schema.String
  })
)

export const HmacFixtureSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("hmac-sha256"),
  keyHex: Schema.String,
  messageHex: Schema.String,
  expectedHex: Schema.String
})

export const HkdfFixtureSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("hkdf-sha256"),
  ikmHex: Schema.String,
  saltHex: Schema.optional(Schema.String),
  infoHex: Schema.String,
  length: Schema.Number,
  expectedHex: Schema.String
})

export const HmacHkdfFixtureSchema = Schema.parseJson(Schema.Union(HmacFixtureSchema, HkdfFixtureSchema))

export const RuntimeParityFixtureSchema = Schema.parseJson(
  Schema.Struct({
    runtime: Schema.Literal("python", "rust"),
    generatedAt: Schema.String,
    cases: Schema.NonEmptyArray(
      Schema.Struct({
        id: Schema.String,
        algorithm: Schema.Literal("blake3-256", "sha256"),
        inputUtf8: Schema.String,
        expectedHex: Schema.String
      })
    )
  })
)

export type FixtureKind = Schema.Schema.Type<typeof FixtureKindSchema>
