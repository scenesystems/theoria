/**
 * Hugging Face route metadata helpers.
 *
 * @since 0.1.0
 */
import type { ExecutionRoute } from "../contracts/ExecutionRoute.js"
import type { RouteSelectionPolicy } from "../contracts/RouteSelectionPolicy.js"

/**
 * Creates a normalized Hugging Face routed-provider execution route.
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
 * Creates a normalized Hugging Face dedicated-endpoint execution route.
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
