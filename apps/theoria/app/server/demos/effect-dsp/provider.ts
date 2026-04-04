import type * as LanguageModel from "@effect/ai/LanguageModel"
import { ConfigProvider, Context, Effect, Either, Layer, Option, Schema } from "effect"

import type * as InferenceContracts from "../../../../../packages/effect-inference/src/contracts/index.js"
import * as InferenceRuntime from "../../../../../packages/effect-inference/src/Runtime/index.js"

import type { DspProvider } from "../../../contracts/capabilities.js"

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

export class DspProviderRuntime extends Context.Tag("@theoria/app/server/demos/effect-dsp/DspProviderRuntime")<
  DspProviderRuntime,
  {
    readonly capability: ProviderCapability
    readonly resolution: {
      readonly desired: Option.Option<InferenceContracts.DesiredRuntimeDescriptor>
      readonly resolvedRoute: Option.Option<InferenceContracts.ResolvedRouteDescriptor>
    }
    readonly layer: Option.Option<
      Layer.Layer<LanguageModel.LanguageModel, never, never>
    >
  }
>() {}

const defaultConfigProvider = ConfigProvider.fromEnv().pipe(ConfigProvider.constantCase)

const providerForRuntime = (provider: InferenceRuntime.LiveTextProvider): DspProvider =>
  provider === "openai"
    ? "openai"
    : provider === "anthropic"
      ? "anthropic"
      : "openrouter"

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

const resolvedRuntime = Effect.gen(function*() {
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

const makeRuntime = Effect.either(resolvedRuntime).pipe(
  Effect.map(
    Either.match({
      onLeft: (error) => disabledRuntime(reasonFromError(error)),
      onRight: (runtime) => runtime
    })
  )
)

export const DspProviderRuntimeLive = Layer.effect(DspProviderRuntime, makeRuntime)
