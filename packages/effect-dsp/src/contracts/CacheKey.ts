/**
 * Compatibility key schema retained for earlier cache integrations.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"
import { ModuleId } from "./ModuleId.js"

/**
 * Carries caller-computed cache partitions for compatibility integrations.
 *
 * @remarks
 * The schema validates field shapes but does not compute hashes, validate their
 * format, or establish determinism of the cached operation.
 *
 * Use `DspCacheKey` from `@scenesystems/effect-dsp/Cache` for the active cache
 * service, which does not consume this compatibility key.
 *
 * @since 0.1.0
 * @category models
 */
export class CacheKey extends Schema.Class<CacheKey>("CacheKey")({
  /** Module partition validated by {@link ModuleId}. */
  moduleId: ModuleId,
  /** Caller-computed identity of the module input. */
  inputHash: Schema.String,
  /** Caller-computed identity of the module parameter state. */
  paramsHash: Schema.String,
  /** Optional candidate partition; no integer or range constraint is applied. */
  rolloutId: Schema.optional(Schema.Number)
}) {}
