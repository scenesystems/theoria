import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import type { Layer } from "effect"

import * as Errors from "../../src/Errors/index.js"
import * as Runtime from "../../src/Runtime/index.js"
import * as Testing from "../../src/testing/index.js"

const assertLayer = <A, E, R>(_: Layer.Layer<A, E, R>): true => true

describe("Runtime/runtime-service", () => {
  it.effect("keeps runtime resolution behind a service tag and Layer-based live surfaces", () =>
    Effect.gen(function*() {
      const desired = {
        artifact: { modelRef: "openai/gpt-4o-mini" }
      }
      const resolution = Testing.makeRuntimeResolution({ desired })

      expect(assertLayer(Runtime.RuntimeResolverLive)).toBe(true)
      expect(assertLayer(Testing.staticRuntimeResolver(resolution))).toBe(true)

      const resolver = yield* Runtime.RuntimeResolver.pipe(
        Effect.provide(Testing.staticRuntimeResolver(resolution))
      )
      const resolved = yield* resolver.resolve(desired)

      expect(resolved.desired.artifact.modelRef).toBe("openai/gpt-4o-mini")

      const liveResolver = yield* Runtime.RuntimeResolver.pipe(Effect.provide(Runtime.RuntimeResolverLive))
      const liveResolution = yield* liveResolver.resolve({
        artifact: { modelRef: "openai/gpt-4o-mini" },
        route: {
          family: "OpenAiResponses",
          serveMode: "hosted-api",
          authMethod: "api-key",
          baseUrl: "https://api.openai.com/v1"
        }
      })
      const liveError = yield* liveResolver.resolve(desired).pipe(Effect.flip)

      expect(Option.isSome(liveResolution.layers.languageModel)).toBe(true)
      expect(liveError).toEqual(
        new Errors.UnsupportedRoute({
          reason: "DesiredRuntimeDescriptor.route is required for live runtime resolution"
        })
      )
    }))
})
