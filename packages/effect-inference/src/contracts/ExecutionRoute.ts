/**
 * Execution-route authority for transport and deployment identity.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { AuthMethodSchema } from "./AuthMethod.js"
import { StableRouteFamilySchema } from "./RouteFamily.js"
import { RouteSelectionPolicySchema } from "./RouteSelectionPolicy.js"
import { RuntimeFlavorSchema } from "./RuntimeFlavor.js"
import { ServeModeSchema } from "./ServeMode.js"

/**
 * Schema describing how a runtime can be reached without encoding the model
 * requested by the caller.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ExecutionRouteSchema = Schema.Struct({
  family: StableRouteFamilySchema,
  serveMode: ServeModeSchema,
  authMethod: AuthMethodSchema,
  baseUrl: Schema.String,
  endpointId: Schema.optional(Schema.String),
  deploymentId: Schema.optional(Schema.String),
  gatewayId: Schema.optional(Schema.String),
  selectionPolicy: Schema.optional(RouteSelectionPolicySchema),
  runtimeFlavorHint: Schema.optional(RuntimeFlavorSchema)
})

/**
 * Extracted execution-route record.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ExecutionRoute = Schema.Schema.Type<typeof ExecutionRouteSchema>
