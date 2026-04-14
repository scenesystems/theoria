/**
 * Raw `pi-share-hf` review-sidecar contracts consumed by the open-agent-trace lane.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

/**
 * One per-session review sidecar emitted alongside `pi-share-hf` public rows.
 *
 * @since 0.2.0
 * @category schemas
 */
export class PiShareHfReviewSidecar extends Schema.Class<PiShareHfReviewSidecar>("PiShareHfReviewSidecar")({
  about_project: Schema.Boolean,
  shareable: Schema.Boolean,
  missed_sensitive_data: Schema.Boolean,
  review_key: Schema.Redacted(Schema.NonEmptyString),
  prompt_version: Schema.Number,
  semantic_review_status: Schema.optional(Schema.Literal("approved", "manual-review-required", "not-reviewed")),
  policy_id: Schema.optional(Schema.String),
  policy_version: Schema.optional(Schema.Number)
}) {}
