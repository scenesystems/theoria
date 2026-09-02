/**
 * Transport and deployment identity selected before inference begins.
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
 * Decodes a stable transport route. Model intent and response observations
 * belong to separate descriptors.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ExecutionRouteSchema = Schema.Struct({
  /** Wire protocol or provider API family used by the adapter. */
  family: StableRouteFamilySchema,
  /** Deployment boundary behind the route. */
  serveMode: ServeModeSchema,
  /** Credential transport expected by the endpoint. */
  authMethod: AuthMethodSchema,
  /** Adapter base URL; the schema does not validate URL syntax. */
  baseUrl: Schema.String,
  /** Provider endpoint identity when a dedicated endpoint is selected. */
  endpointId: Schema.optional(Schema.String),
  /** Deployment identity selected within an endpoint or provider. */
  deploymentId: Schema.optional(Schema.String),
  /** Broker or gateway identity for routed requests. */
  gatewayId: Schema.optional(Schema.String),
  /** Broker selection instruction, when the route delegates provider choice. */
  selectionPolicy: Schema.optional(RouteSelectionPolicySchema),
  /** Serving-engine hint used by conservative capability policy. */
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
