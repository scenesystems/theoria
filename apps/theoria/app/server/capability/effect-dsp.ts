import type * as LanguageModel from "@effect/ai/LanguageModel"
import { ConfigProvider, Context, Effect, Either, Layer, Option, Schema } from "effect"

import type * as InferenceContracts from "effect-inference/Contracts"
import * as InferenceRuntime from "effect-inference/Runtime"

import type { DspProvider } from "../../contracts/capability/availability.js"
import type { DspRuntimeProjection } from "../../contracts/capability/effect-dsp-runtime-projection.js"

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

export class DspProviderRuntime extends Context.Tag("@theoria/app/server/capability/effect-dsp/DspProviderRuntime")<
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

const disabledRuntime = (reason: string) =>
  DspProviderRuntime.of({
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

  return DspProviderRuntime.of({
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

const resolveDspProviderRuntime = Effect.either(resolvedProviderRuntime).pipe(
  Effect.flatMap(
    Either.match({
      onLeft: (error) => Effect.succeed(disabledRuntime(reasonFromError(error))),
      onRight: Effect.succeed
    })
  )
)

export const DspProviderRuntimeLive = Layer.effect(DspProviderRuntime, resolveDspProviderRuntime)
