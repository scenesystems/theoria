/**
 * Checked-in execution fixture nouns for coding-trace judging.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

/**
 * Stable stage names for execution-backed coding proofs.
 *
 * @since 0.2.0
 * @category schemas
 */
export const CodingExecutionStageSchema = Schema.Literal("check", "lint", "test", "build")

/**
 * Package-owned patch payload written into a temporary repository fixture.
 *
 * @since 0.2.0
 * @category models
 */
export class CodingExecutionPatchFile extends Schema.Class<CodingExecutionPatchFile>(
  "OpenAgentTrace/CodingExecutionPatchFile"
)({
  path: Schema.String,
  content: Schema.String
}) {}

/**
 * One deterministic command in the checked-in execution manifest.
 *
 * @since 0.2.0
 * @category models
 */
export class CodingExecutionRunManifestEntry extends Schema.Class<CodingExecutionRunManifestEntry>(
  "OpenAgentTrace/CodingExecutionRunManifestEntry"
)({
  stage: CodingExecutionStageSchema,
  command: Schema.NonEmptyArray(Schema.String)
}) {}

/**
 * Checked-in repository fixture used for execution-backed scoring.
 *
 * @since 0.2.0
 * @category models
 */
export class CodingExecutionFixture extends Schema.Class<CodingExecutionFixture>(
  "OpenAgentTrace/CodingExecutionFixture"
)({
  fixtureId: Schema.String,
  sourceThreadId: Schema.String,
  repoDirectory: Schema.String,
  patchFiles: Schema.NonEmptyArray(CodingExecutionPatchFile),
  runManifest: Schema.NonEmptyArray(CodingExecutionRunManifestEntry),
  requiredStrategySignals: Schema.Array(Schema.String)
}) {}

/**
 * Example metadata consumed by contextual execution metrics.
 *
 * @since 0.2.0
 * @category models
 */
export class CodingExecutionMetricMetadata extends Schema.Class<CodingExecutionMetricMetadata>(
  "OpenAgentTrace/CodingExecutionMetricMetadata"
)({
  fixtureId: Schema.String
}) {
  /**
   * Build contextual execution metric metadata for one checked-in fixture.
   *
   * @since 0.2.0
   */
  static of(fixtureId: string): CodingExecutionMetricMetadata {
    return new CodingExecutionMetricMetadata({ fixtureId })
  }
}

/**
 * Result of one manifest command against a temporary repository copy.
 *
 * @since 0.2.0
 * @category models
 */
export class CodingExecutionRunResult extends Schema.Class<CodingExecutionRunResult>(
  "OpenAgentTrace/CodingExecutionRunResult"
)({
  stage: CodingExecutionStageSchema,
  command: Schema.String,
  exitCode: Schema.Number,
  passed: Schema.Boolean,
  stdout: Schema.String,
  stderr: Schema.String
}) {}

/**
 * Aggregate execution-backed scoring result for one checked-in fixture run.
 *
 * @since 0.2.0
 * @category models
 */
export class CodingExecutionJudgeResult extends Schema.Class<CodingExecutionJudgeResult>(
  "OpenAgentTrace/CodingExecutionJudgeResult"
)({
  fixtureId: Schema.String,
  sourceThreadId: Schema.String,
  patchApplied: Schema.Boolean,
  allPassed: Schema.Boolean,
  score: Schema.Number,
  fileTouches: Schema.Array(Schema.String),
  runs: Schema.Array(CodingExecutionRunResult),
  feedback: Schema.String
}) {}
