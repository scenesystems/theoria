import type * as LanguageModel from "@effect/ai/LanguageModel"
import { ConfigProvider, Context, Effect, Either, Layer, Option, Schema } from "effect"

import type * as InferenceContracts from "../../../../../../packages/effect-inference/src/contracts/index.js"
import * as InferenceRuntime from "../../../../../../packages/effect-inference/src/Runtime/index.js"

import type { DspProvider } from "../../../contracts/capabilities.js"
import type { DspRuntimeProjection } from "../../../contracts/dsp-runtime-projection.js"

export class DspProviderUnavailable extends Schema.TaggedError<DspProviderUnavailable>()(
  "DspProviderUnavailable",
  {
    message: Schema.String
  }
) {}

type ProviderCapability = {
  readonly enabled: boolean
  readonly provider: Option.Option<DspProvider>
  readonly model: Option.Option<string>
  readonly routeFamily: Option.Option<InferenceContracts.StableRouteFamily>
  readonly baseUrl: Option.Option<string>
  readonly reason: Option.Option<string>
}

type ProviderResolution = {
  readonly desired: Option.Option<InferenceContracts.DesiredRuntimeDescriptor>
  readonly resolvedRoute: Option.Option<InferenceContracts.ResolvedRouteDescriptor>
}

export class DspProviderRuntime extends Context.Tag("@theoria/app/server/demos/effect-dsp/DspProviderRuntime")<
  DspProviderRuntime,
  {
    readonly capability: ProviderCapability
    readonly resolution: ProviderResolution
    readonly layer: Option.Option<
      Layer.Layer<LanguageModel.LanguageModel, never, never>
    >
  }
>() {}

const defaultConfigProvider = ConfigProvider.fromEnv().pipe(ConfigProvider.constantCase)

const providerForRuntime = (provider: InferenceRuntime.LiveTextProvider): DspProvider => {
  if (provider === "openai") {
    return "openai"
  }

  if (provider === "anthropic") {
    return "anthropic"
  }

  return "openrouter"
}

const reasonFromError = (error: unknown): string =>
  typeof error === "object" && error !== null && "reason" in error
    ? String(error.reason)
    : "DSP runtime resolution failed."

const emptyResolution = {
  desired: Option.none<InferenceContracts.DesiredRuntimeDescriptor>(),
  resolvedRoute: Option.none<InferenceContracts.ResolvedRouteDescriptor>()
}

const makeProviderRuntime = (options: {
  readonly capability: ProviderCapability
  readonly resolution: ProviderResolution
  readonly layer: Option.Option<Layer.Layer<LanguageModel.LanguageModel, never, never>>
}) =>
  DspProviderRuntime.of({
    capability: options.capability,
    resolution: options.resolution,
    layer: options.layer
  })

const disabledRuntime = (reason: string) =>
  makeProviderRuntime({
    capability: {
      enabled: false,
      provider: Option.none(),
      model: Option.none(),
      routeFamily: Option.none(),
      baseUrl: Option.none(),
      reason: Option.some(reason)
    },
    resolution: emptyResolution,
    layer: Option.none()
  })

const resolvedProviderRuntime = Effect.gen(function*() {
  const runtime = yield* InferenceRuntime.resolveLiveTextProviderRuntime({
    configProvider: defaultConfigProvider
  })
  const resolver = yield* InferenceRuntime.RuntimeResolver.pipe(
    Effect.provide(InferenceRuntime.RuntimeResolverLive)
  )
  const resolution = yield* resolver.resolve(runtime.desired)

  return makeProviderRuntime({
    capability: {
      enabled: true,
      provider: Option.some(providerForRuntime(runtime.provider)),
      model: Option.some(runtime.model),
      routeFamily: Option.some(resolution.resolvedRoute.route.family),
      baseUrl: Option.some(resolution.resolvedRoute.route.baseUrl),
      reason: Option.none()
    },
    resolution: {
      desired: Option.some(runtime.desired),
      resolvedRoute: Option.some(resolution.resolvedRoute)
    },
    layer: Option.some(runtime.languageModelLayer)
  })
})

export const dspRuntimeProjection = (runtime: {
  readonly capability: ProviderCapability
  readonly resolution: ProviderResolution
}): Effect.Effect<DspRuntimeProjection> =>
  Effect.succeed({
    enabled: runtime.capability.enabled,
    ...Option.match(runtime.capability.reason, {
      onNone: () => ({}),
      onSome: (reason) => ({ reason })
    }),
    ...Option.match(runtime.resolution.desired, {
      onNone: () => ({}),
      onSome: (requestedRuntime) => ({ requestedRuntime })
    }),
    ...Option.match(runtime.resolution.resolvedRoute, {
      onNone: () => ({}),
      onSome: (resolvedRoute) => ({ resolvedRoute })
    })
  })

const makeRuntime = Effect.either(resolvedProviderRuntime).pipe(
  Effect.flatMap(
    Either.match({
      onLeft: (error) => Effect.succeed(disabledRuntime(reasonFromError(error))),
      onRight: Effect.succeed
    })
  )
)

export const DspProviderRuntimeLive = Layer.effect(DspProviderRuntime, makeRuntime)
