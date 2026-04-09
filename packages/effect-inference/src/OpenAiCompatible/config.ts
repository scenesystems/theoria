/**
 * OpenAI-compatible descriptor helpers.
 *
 * @since 0.1.0
 */
import { Data } from "effect"

import type { DesiredRuntimeDescriptor } from "../contracts/DesiredRuntimeDescriptor.js"
import type { ExecutionRoute } from "../contracts/ExecutionRoute.js"
import { OpenAiCompatibleRoute } from "./metadata.js"

/**
 * Minimal transport information shared by compatible chat-completions style
 * runtimes.
 *
 * @since 0.1.0
 * @category models
 */
export class CompatibleTransport extends Data.Class<{
  readonly baseUrl: string
  readonly authMethod: ExecutionRoute["authMethod"]
}> {}

/**
 * Future-proof transport planning record that preserves the original route
 * identity above the shared HTTP seam.
 *
 * @since 0.1.0
 * @category models
 */
export class CompatibleTransportPlan extends Data.Class<{
  readonly route: ExecutionRoute
  readonly transport: CompatibleTransport
}> {}

/**
 * Adds a normalized OpenAI-compatible route hint to a desired runtime
 * descriptor.
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
  route: OpenAiCompatibleRoute.make(options)
})

/**
 * Projects a stable execution route onto the shared compatible transport seam
 * without collapsing route-family or deployment identity.
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
