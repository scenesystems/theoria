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
 * Decodes transport and deployment identity without admitting the requested
 * model or any observations from a provider response.
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
 * Describes the transport, deployment boundary, and authentication method used
 * to reach inference. It deliberately excludes requested and response model
 * identity so route provenance cannot be mistaken for execution evidence.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ExecutionRoute = Schema.Schema.Type<typeof ExecutionRouteSchema>
