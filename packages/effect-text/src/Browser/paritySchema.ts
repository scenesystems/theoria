/**
 * Browser parity artifact schemas.
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
 * Stable parity-case identifier type.
 *
 * @since 0.2.0
 * @category models
 */
export type BrowserParityCaseIdType = typeof BrowserParityCaseIdSchema.Type

/**
 * One resolved parity artifact case.
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
 * One resolved parity artifact case type.
 *
 * @since 0.2.0
 * @category models
 */
export type BrowserParityArtifactCaseType = typeof BrowserParityArtifactCaseSchema.Type

/**
 * Machine-readable parity artifact schema.
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
 * Machine-readable parity artifact type.
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
