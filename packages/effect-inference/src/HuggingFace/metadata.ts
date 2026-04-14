/**
 * Hugging Face route metadata helpers.
 *
 * @since 0.1.0
 */
import type { ExecutionRoute } from "../contracts/ExecutionRoute.js"
import type { RouteSelectionPolicy } from "../contracts/RouteSelectionPolicy.js"

/**
 * Routed-provider Hugging Face route authority.
 *
 * @since 0.1.0
 * @category constructors
 */
export type HuggingFaceRoutedRoute = ExecutionRoute

/**
 * Noun-owned constructor surface for routed-provider Hugging Face execution routes.
 *
 * @since 0.1.0
 * @category constructors
 */
export const HuggingFaceRoutedRoute = {
  make: (options: {
    readonly baseUrl: string
    readonly authMethod: ExecutionRoute["authMethod"]
    readonly gatewayId?: string
    readonly selectionPolicy?: RouteSelectionPolicy
  }): HuggingFaceRoutedRoute => ({
    family: "HuggingFace",
    baseUrl: options.baseUrl,
    serveMode: "routed-marketplace",
    authMethod: options.authMethod,
    gatewayId: options.gatewayId,
    selectionPolicy: options.selectionPolicy
  })
}

/**
 * Dedicated-endpoint Hugging Face route authority.
 *
 * @since 0.1.0
 * @category constructors
 */
export type HuggingFaceEndpointRoute = ExecutionRoute

/**
 * Noun-owned constructor surface for dedicated-endpoint Hugging Face execution routes.
 *
 * @since 0.1.0
 * @category constructors
 */
export const HuggingFaceEndpointRoute = {
  make: (options: {
    readonly baseUrl: string
    readonly authMethod: ExecutionRoute["authMethod"]
    readonly endpointId?: string
    readonly deploymentId?: string
    readonly runtimeFlavorHint?: ExecutionRoute["runtimeFlavorHint"]
  }): HuggingFaceEndpointRoute => ({
    family: "HuggingFace",
    baseUrl: options.baseUrl,
    serveMode: "dedicated-endpoint",
    authMethod: options.authMethod,
    endpointId: options.endpointId,
    deploymentId: options.deploymentId,
    runtimeFlavorHint: options.runtimeFlavorHint
  })
}
