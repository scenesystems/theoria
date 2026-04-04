import { Schema } from "effect"

import { Browser, Text } from "../../src/index.js"

export const BrowserAccuracyCaseIdSchema = Schema.Literal(
  "white-space-normal",
  "white-space-pre-wrap",
  "trailing-whitespace-hard-breaks",
  "tab-advances",
  "soft-hyphen",
  "mixed-inline-punctuation",
  "fit-paint-divergence"
)

export type BrowserAccuracyCaseIdType = typeof BrowserAccuracyCaseIdSchema.Type

export const BrowserAccuracyArtifactCaseSchema = Schema.Struct({
  caseId: BrowserAccuracyCaseIdSchema,
  prepare: Text.PrepareInput,
  request: Text.LayoutRequest,
  summary: Text.LayoutSummary,
  lines: Schema.Array(Text.LayoutLine)
})

export type BrowserAccuracyArtifactCaseType = typeof BrowserAccuracyArtifactCaseSchema.Type

export const BrowserAccuracyArtifactSchema = Schema.Struct({
  profileId: Browser.BrowserSupportProfileIdSchema,
  fontFamily: Schema.String,
  fontSelection: Schema.String,
  fontStack: Schema.Array(Schema.String).pipe(Schema.minItems(1)),
  parityCases: Schema.Array(BrowserAccuracyCaseIdSchema).pipe(Schema.minItems(1)),
  cases: Schema.Array(BrowserAccuracyArtifactCaseSchema).pipe(Schema.minItems(1))
})

export type BrowserAccuracyArtifactType = typeof BrowserAccuracyArtifactSchema.Type

export const BrowserAccuracyArtifactJsonSchema = Schema.parseJson(BrowserAccuracyArtifactSchema)
