/**
 * Private GEPA score aliases and reflective-dataset rows.
 * Public candidate, frontier, schedule and reflective-example models belong to GEPA.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.1.0
 */
import { Data, Schema } from "effect"
import type { ReflectiveExample } from "../../GEPA.js"
import { Score } from "../../Metric.js"
import type { Payload } from "../../Payload.js"

/**
 * Per-example score array for one candidate program across the validation set.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CandidateScoreVector = Schema.Array(Score.fields.value)

/**
 * Per-example score array for one candidate program across the validation set.
 *
 * @since 0.1.0
 * @category models
 */
export type CandidateScoreVector = typeof CandidateScoreVector.Type

/** @internal */
export const CandidateScoreMatrix = Schema.Array(CandidateScoreVector)

/** @internal */
export type CandidateScoreMatrix = typeof CandidateScoreMatrix.Type

/** @internal */
export const CandidateIndices = Schema.Array(Score.fields.value)

/** @internal */
export type CandidateIndices = typeof CandidateIndices.Type

/**
 * Source row used to construct reflective examples from runtime traces and
 * metrics. `metricResult.feedback` provides the canonical feedback.
 * `parseFailureStructure` injects format guidance when parsing failed.
 * Payload fields are produced by `Payload.encode`; GEPA owns the evidence scope.
 *
 * @since 0.1.0
 * @category models
 */
export class ReflectiveDatasetSample extends Data.Class<{
  readonly exampleId: string
  readonly predictorName: string
  readonly evidenceScope: ReflectiveExample["evidenceScope"]
  readonly inputs: Payload
  readonly generatedOutputs: Payload
  readonly expectedOutput: Payload
  readonly metricResult: Score
  readonly parseFailureStructure?: string
}> {}
