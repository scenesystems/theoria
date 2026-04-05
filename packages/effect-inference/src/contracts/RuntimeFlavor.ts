/**
 * Runtime-flavor authority for self-hosted compatible engines.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Stable runtime flavors used to distinguish compatible serving engines.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RuntimeFlavorSchema = Schema.Literal(
  "unknown",
  "vllm",
  "tgi",
  "ollama",
  "lm-studio"
)

/**
 * Extracted runtime-flavor union.
 *
 * @since 0.1.0
 * @category type-level
 */
export type RuntimeFlavor = Schema.Schema.Type<typeof RuntimeFlavorSchema>

/**
 * Returns the conservative default when runtime flavor is not known yet.
 *
 * @since 0.1.0
 * @category constructors
 */
export const defaultRuntimeFlavor = (): RuntimeFlavor => "unknown"
