/**
 * Execution-route construction for Hugging Face adapters.
 *
 * @since 0.1.0
 */
import type { ExecutionRoute } from "../contracts/ExecutionRoute.js"
import type { RouteSelectionPolicy } from "../contracts/RouteSelectionPolicy.js"

/**
 * Records a Hugging Face marketplace route with broker selection metadata. It
 * performs no provider lookup or URL validation.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeHuggingFaceRoutedRoute = (options: {
  readonly baseUrl: string
  readonly authMethod: ExecutionRoute["authMethod"]
  readonly gatewayId?: string
  readonly selectionPolicy?: RouteSelectionPolicy
}): ExecutionRoute => ({
  family: "HuggingFace",
  baseUrl: options.baseUrl,
  serveMode: "routed-marketplace",
  authMethod: options.authMethod,
  gatewayId: options.gatewayId,
  selectionPolicy: options.selectionPolicy
})

/**
 * Records a Hugging Face dedicated endpoint. It performs no endpoint lookup or
 * URL validation.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeHuggingFaceEndpointRoute = (options: {
  readonly baseUrl: string
  readonly authMethod: ExecutionRoute["authMethod"]
  readonly endpointId?: string
  readonly deploymentId?: string
  readonly runtimeFlavorHint?: ExecutionRoute["runtimeFlavorHint"]
}): ExecutionRoute => ({
  family: "HuggingFace",
  baseUrl: options.baseUrl,
  serveMode: "dedicated-endpoint",
  authMethod: options.authMethod,
  endpointId: options.endpointId,
  deploymentId: options.deploymentId,
  runtimeFlavorHint: options.runtimeFlavorHint
})
