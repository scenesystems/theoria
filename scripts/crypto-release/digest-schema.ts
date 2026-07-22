import { Schema } from "effect"

const Hex = Schema.String.pipe(Schema.pattern(/^(?:[a-f0-9]{2})*$/))
const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))
const NonNegativeInt = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))

const KatIdentity = {
  id: Schema.NonEmptyString,
  sourceId: Schema.NonEmptyString
}

export const DigestKat = Schema.Union(
  Schema.TaggedStruct("Blake3Hash", {
    ...KatIdentity,
    inputLength: NonNegativeInt,
    expectedHex: Hex
  }),
  Schema.TaggedStruct("Blake3Mac", {
    ...KatIdentity,
    inputLength: NonNegativeInt,
    key: Schema.NonEmptyString,
    expectedHex: Hex
  }),
  Schema.TaggedStruct("Blake3DeriveKey", {
    ...KatIdentity,
    inputLength: NonNegativeInt,
    context: Schema.NonEmptyString,
    expectedHex: Hex
  }),
  Schema.TaggedStruct("Sha256", {
    ...KatIdentity,
    inputHex: Hex,
    expectedHex: Hex
  }),
  Schema.TaggedStruct("Hmac", {
    ...KatIdentity,
    algorithm: Schema.Literal("hmac-sha1", "hmac-sha256"),
    keyHex: Hex,
    messageHex: Hex,
    outputLength: PositiveInt,
    expectedHex: Hex
  }),
  Schema.TaggedStruct("Hkdf", {
    ...KatIdentity,
    algorithm: Schema.Literal("hkdf-sha256", "hkdf-sha512"),
    ikmHex: Hex,
    saltHex: Schema.NullOr(Hex),
    infoHex: Hex,
    outputLength: NonNegativeInt,
    expectedHex: Hex
  }),
  Schema.TaggedStruct("Jcs", {
    ...KatIdentity,
    input: Schema.Unknown,
    expectedCanonical: Schema.String
  }),
  Schema.TaggedStruct("InvalidUnicode", {
    ...KatIdentity,
    target: Schema.Literal("key", "value"),
    input: Schema.String,
    expectedKind: Schema.Literal("lone-high-surrogate", "lone-low-surrogate"),
    expectedCodeUnitIndex: NonNegativeInt
  })
)

export const DigestKatProfile = Schema.Struct({
  format: Schema.Literal("digest-packed-runtime-kats-v1"),
  cases: Schema.NonEmptyArray(DigestKat)
})

export const DigestKatProfileJson = Schema.parseJson(DigestKatProfile)

export const DigestRuntimeReport = Schema.Struct({
  format: Schema.Literal("digest-packed-runtime-report-v1"),
  katIds: Schema.NonEmptyArray(Schema.NonEmptyString),
  katCount: PositiveInt
})

export const DigestRuntimeReportJson = Schema.parseJson(DigestRuntimeReport)

export class DigestKatFailure extends Schema.TaggedError<DigestKatFailure>()(
  "DigestKatFailure",
  {
    katId: Schema.NonEmptyString,
    operation: Schema.NonEmptyString
  }
) {}

export type DigestKat = Schema.Schema.Type<typeof DigestKat>
export type DigestKatProfile = Schema.Schema.Type<typeof DigestKatProfile>
export type DigestRuntimeReport = Schema.Schema.Type<typeof DigestRuntimeReport>
