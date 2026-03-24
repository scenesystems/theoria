/**
 * Composite cache key for module-level memoization of LM calls.
 *
 * @since 0.0.0
 */
import { Schema } from "effect"
import { ModuleId } from "./ModuleId.js"

/**
 * Composite memoization key combining module identity, input content hash,
 * parameter state hash, and optional rollout index. Two forward calls with
 * identical cache keys are guaranteed to produce the same LM response,
 * enabling deterministic replay during optimization.
 *
 * @see {@link ModuleId} — the module identity component
 * @see {@link ModuleParams} — parameter state that feeds the `paramsHash`
 *
 * @since 0.0.0
 * @category models
 */
export class CacheKey extends Schema.Class<CacheKey>("CacheKey")({
  moduleId: ModuleId,
  inputHash: Schema.String,
  paramsHash: Schema.String,
  rolloutId: Schema.optional(Schema.Number)
}) {}
