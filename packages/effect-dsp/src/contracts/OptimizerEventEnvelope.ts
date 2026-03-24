/**
 * Uniform wrapper that lets heterogeneous optimizer progress events flow
 * through a single shared `Stream`.
 *
 * @since 0.0.0
 */
import { Schema } from "effect"
import { OptimizerKind } from "./OptimizerKind.js"

/**
 * Uniform envelope that wraps optimizer-specific progress events for
 * transport through a shared `Stream`. The `optimizer` field identifies
 * which algorithm emitted the event, `eventTag` carries the per-optimizer
 * event discriminant (e.g. `"TrialComplete"`, `"CandidateSelected"`), and
 * `payload` holds the algorithm-specific data. Consumers pattern-match on
 * `optimizer` + `eventTag` to dispatch to typed handlers.
 *
 * @see {@link OptimizerKind} — discriminant identifying the emitting optimizer
 *
 * @since 0.0.0
 * @category models
 */
export class OptimizerEventEnvelope extends Schema.Class<OptimizerEventEnvelope>("OptimizerEventEnvelope")({
  optimizer: OptimizerKind,
  eventTag: Schema.String,
  payload: Schema.Record({ key: Schema.String, value: Schema.Unknown })
}) {}
