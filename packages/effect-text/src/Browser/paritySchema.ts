/**
 * Codecs for reproducible prepare inputs and layout outputs from parity runs.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import * as Text from "../Text/index.js"
import { BrowserSupportProfileIdSchema } from "./supportManifest.js"

/**
 * Stable parity-case identifier used by the browser artifact harness.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BrowserParityCaseIdSchema = Schema.Literal(
  "white-space-normal",
  "white-space-pre-wrap",
  "trailing-whitespace-hard-breaks",
  "tab-advances",
  "soft-hyphen",
  "mixed-inline-punctuation",
  "fit-paint-divergence"
)

/**
 * Identifier for a checked-in browser parity scenario.
 *
 * @since 0.2.0
 * @category models
 */
export type BrowserParityCaseIdType = typeof BrowserParityCaseIdSchema.Type

/**
 * Decodes one scenario's preparation input, layout request, summary, and lines.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BrowserParityArtifactCaseSchema = Schema.Struct({
  caseId: BrowserParityCaseIdSchema,
  prepare: Text.PrepareInput,
  request: Text.LayoutRequest,
  summary: Text.LayoutSummary,
  lines: Schema.Array(Text.LayoutLine)
})

/**
 * Decoded result for one browser parity scenario.
 *
 * @since 0.2.0
 * @category models
 */
export type BrowserParityArtifactCaseType = typeof BrowserParityArtifactCaseSchema.Type

/**
 * Decodes a profile-specific artifact including resolved font selection and cases.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BrowserParityArtifactSchema = Schema.Struct({
  profileId: BrowserSupportProfileIdSchema,
  fontFamily: Schema.String,
  fontSelection: Schema.String,
  fontStack: Schema.Array(Schema.String).pipe(Schema.minItems(1)),
  parityCases: Schema.Array(BrowserParityCaseIdSchema).pipe(Schema.minItems(1)),
  cases: Schema.Array(BrowserParityArtifactCaseSchema).pipe(Schema.minItems(1))
})

/**
 * Decoded profile-specific browser parity artifact.
 *
 * @since 0.2.0
 * @category models
 */
export type BrowserParityArtifactType = typeof BrowserParityArtifactSchema.Type

/**
 * JSON codec for checked-in parity artifacts.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BrowserParityArtifactJsonSchema = Schema.parseJson(BrowserParityArtifactSchema)
