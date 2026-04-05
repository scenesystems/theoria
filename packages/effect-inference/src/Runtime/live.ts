/**
 * Live runtime resolver assembly for stable route families.
 *
 * @since 0.1.0
 */
import { Effect, Layer, Option } from "effect"

import type { DesiredRuntimeDescriptor } from "../contracts/DesiredRuntimeDescriptor.js"
import { UnsupportedRoute } from "../Errors/RuntimeResolver.js"
import { ensureCapabilityRequirements } from "../internal/capabilityValidation.js"
import { defaultRuntimeCapabilities } from "../internal/defaultCapabilities.js"
import { makeResolvedModelLayers } from "../internal/liveLayers.js"
import { makeLiveResolvedRouteDescriptor } from "../internal/resolvedRoute.js"
import { RuntimeResolution, RuntimeResolver, RuntimeResolverApi } from "./services.js"

const requireRoute = (descriptor: DesiredRuntimeDescriptor) =>
  descriptor.route
    ? Effect.succeed(descriptor.route)
    : Effect.fail(
      new UnsupportedRoute({
        reason: "DesiredRuntimeDescriptor.route is required for live runtime resolution"
      })
    )

const runtimeResolverLiveApi = new RuntimeResolverApi({
  resolve: (descriptor) =>
    Effect.gen(function*() {
      const route = yield* requireRoute(descriptor)
      const capabilities = defaultRuntimeCapabilities({ route })

      yield* ensureCapabilityRequirements(Option.fromNullable(descriptor.capabilities), capabilities)

      return new RuntimeResolution({
        desired: descriptor,
        resolvedRoute: makeLiveResolvedRouteDescriptor(descriptor, route),
        capabilities,
        layers: makeResolvedModelLayers({ descriptor, route, capabilities })
      })
    })
})

/**
 * Live resolver layer for stable route-family resolution.
 *
 * @since 0.1.0
 * @category layers
 */
export const RuntimeResolverLive = Layer.scoped(RuntimeResolver, Effect.succeed(runtimeResolverLiveApi))
