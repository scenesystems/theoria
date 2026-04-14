/**
 * OpenAI-compatible route metadata helpers.
 *
 * @since 0.1.0
 */
import type { ExecutionRoute } from "../contracts/ExecutionRoute.js"
import { defaultRouteFamily } from "../contracts/RouteFamily.js"

/**
 * OpenAI-compatible route authority.
 *
 * @since 0.1.0
 * @category constructors
 */
export type OpenAiCompatibleRoute = ExecutionRoute

/**
 * Noun-owned constructor surface for stable OpenAI-compatible execution routes.
 *
 * @since 0.1.0
 * @category constructors
 */
export const OpenAiCompatibleRoute = {
  make: (options: {
    readonly baseUrl: string
    readonly serveMode: ExecutionRoute["serveMode"]
    readonly authMethod: ExecutionRoute["authMethod"]
    readonly endpointId?: string
    readonly deploymentId?: string
    readonly gatewayId?: string
    readonly selectionPolicy?: ExecutionRoute["selectionPolicy"]
    readonly runtimeFlavorHint?: ExecutionRoute["runtimeFlavorHint"]
  }): OpenAiCompatibleRoute => ({
    family: defaultRouteFamily(),
    baseUrl: options.baseUrl,
    serveMode: options.serveMode,
    authMethod: options.authMethod,
    endpointId: options.endpointId,
    deploymentId: options.deploymentId,
    gatewayId: options.gatewayId,
    selectionPolicy: options.selectionPolicy,
    runtimeFlavorHint: options.runtimeFlavorHint
  })
}
