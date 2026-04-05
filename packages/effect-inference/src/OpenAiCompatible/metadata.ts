/**
 * OpenAI-compatible route metadata helpers.
 *
 * @since 0.1.0
 */
import type { ExecutionRoute } from "../contracts/ExecutionRoute.js"
import { defaultRouteFamily } from "../contracts/RouteFamily.js"

/**
 * Creates a normalized OpenAI-compatible execution-route record.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeOpenAiCompatibleRoute = (options: {
  readonly baseUrl: string
  readonly serveMode: ExecutionRoute["serveMode"]
  readonly authMethod: ExecutionRoute["authMethod"]
  readonly endpointId?: string
  readonly deploymentId?: string
  readonly gatewayId?: string
  readonly selectionPolicy?: ExecutionRoute["selectionPolicy"]
  readonly runtimeFlavorHint?: ExecutionRoute["runtimeFlavorHint"]
}): ExecutionRoute => ({
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
