/**
 * Composite cache key for module-level memoization of LM calls.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"
import { ModuleId } from "./ModuleId.js"

/**
 * Legacy schema for partitioning cached calls by module, hashed input,
 * hashed parameter state, and optional rollout index. This schema does not
 * compute hashes or assert that the underlying model is deterministic.
 *
 * @see {@link ModuleId} — the module identity component
 * @see {@link ModuleParams} — parameter state that feeds the `paramsHash`
 *
 * @since 0.1.0
 * @category models
 */
export class CacheKey extends Schema.Class<CacheKey>("CacheKey")({
  moduleId: ModuleId,
  inputHash: Schema.String,
  paramsHash: Schema.String,
  rolloutId: Schema.optional(Schema.Number)
}) {}
