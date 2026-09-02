/**
 * Deployment boundaries used by inference routes.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Accepts direct hosted APIs, brokered marketplaces, dedicated endpoints, and
 * caller-operated runtimes.
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
 * Classifies the deployment boundary behind a route, distinguishing direct
 * hosted APIs, broker-selected providers, dedicated endpoints, and runtimes
 * operated locally or by the caller.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ServeMode = Schema.Schema.Type<typeof ServeModeSchema>
