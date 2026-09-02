/**
 * Route construction and transport planning for OpenAI-compatible endpoints.
 *
 * @since 0.1.0
 */
import { Data } from "effect"

import type { DesiredRuntimeDescriptor } from "../contracts/DesiredRuntimeDescriptor.js"
import type { ExecutionRoute } from "../contracts/ExecutionRoute.js"
import { makeOpenAiCompatibleRoute } from "./metadata.js"

/**
 * Client endpoint and authentication metadata projected from an execution route.
 * No credential is retained.
 *
 * @since 0.1.0
 * @category models
 */
export class CompatibleTransport extends Data.Class<{
  /** Endpoint prefix passed to the Effect AI client. */
  readonly baseUrl: string
  /** Credential mechanism recorded for the route; no secret is stored. */
  readonly authMethod: ExecutionRoute["authMethod"]
}> {}

/**
 * Pairs an execution route with the base URL and authentication method needed
 * by an OpenAI-compatible client.
 *
 * @since 0.1.0
 * @category models
 */
export class CompatibleTransportPlan extends Data.Class<{
  /** Complete provenance route retained by the plan. */
  readonly route: ExecutionRoute
  /** Client settings projected from `route`. */
  readonly transport: CompatibleTransport
}> {}

/**
 * Replaces any existing route with an `OpenAiCompatible` route. Model intent,
 * capability requirements, role, and tags retain their original identity.
 *
 * @since 0.1.0
 * @category constructors
 */
export const withOpenAiCompatibleRoute = (descriptor: DesiredRuntimeDescriptor, options: {
  readonly baseUrl: string
  readonly serveMode: ExecutionRoute["serveMode"]
  readonly authMethod: ExecutionRoute["authMethod"]
  readonly endpointId?: string
  readonly deploymentId?: string
  readonly gatewayId?: string
  readonly selectionPolicy?: ExecutionRoute["selectionPolicy"]
  readonly runtimeFlavorHint?: ExecutionRoute["runtimeFlavorHint"]
}): DesiredRuntimeDescriptor => ({
  ...descriptor,
  route: makeOpenAiCompatibleRoute(options)
})

/**
 * Projects client transport settings while retaining the complete route for
 * provenance. It performs no validation or I/O.
 *
 * @since 0.1.0
 * @category constructors
 */
export const planCompatibleTransport = (
  route: ExecutionRoute
): CompatibleTransportPlan =>
  new CompatibleTransportPlan({
    route,
    transport: new CompatibleTransport({
      baseUrl: route.baseUrl,
      authMethod: route.authMethod
    })
  })
