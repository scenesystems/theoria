/**
 * Serve-mode authority describing how a runtime is reached.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Declares whether a runtime is hosted directly, brokered, dedicated, or
 * self-hosted.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ServeModeSchema = Schema.Literal(
  "hosted-api",
  "routed-marketplace",
  "dedicated-endpoint",
  "self-hosted",
  "local-runtime"
)

/**
 * Extracted serve-mode union.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ServeMode = Schema.Schema.Type<typeof ServeModeSchema>
