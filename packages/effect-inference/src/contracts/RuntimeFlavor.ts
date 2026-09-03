/**
 * Serving-engine hints for compatible and dedicated runtimes.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Accepts serving-engine identities used by capability policy and route
 * provenance.
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
 * Identifies the compatible serving engine used for capability policy and
 * provenance. `unknown` is the conservative value when resolution cannot
 * establish an engine; it is not evidence that no engine exists.
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
