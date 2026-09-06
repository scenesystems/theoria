/**
 * Shared live-provider runtime composition for examples.
 */
import type * as LanguageModel from "@effect/ai/LanguageModel"
import { Effect, Layer, type Scope } from "effect"

import { InvalidRuntimeConfig } from "@scenesystems/effect-inference/Errors"
import {
  type LiveTextProvider as LiveProvider,
  liveTextProviderLayer,
  type LiveTextProviderRuntimeOptions,
  type ResolvedLiveTextProviderRuntime as ResolvedLiveProviderConfig,
  resolveLiveTextProviderRuntime,
  withLiveTextProvider
} from "@scenesystems/effect-inference/Runtime"

export { InvalidRuntimeConfig as LiveProviderRuntimeError }

export type { LiveProvider, LiveTextProviderRuntimeOptions as LiveProviderRuntimeOptions, ResolvedLiveProviderConfig }

export const resolveLiveProviderConfig = resolveLiveTextProviderRuntime

export const liveLanguageModelLayer = (
  options: LiveTextProviderRuntimeOptions = {}
): Layer.Layer<LanguageModel.LanguageModel, InvalidRuntimeConfig, never> => liveTextProviderLayer(options)

/** Builds the fallible live provider once and exposes its services as an infallible teacher layer. */
export const liveTeacherLayer = (
  options: LiveTextProviderRuntimeOptions = {}
): Effect.Effect<Layer.Layer<LanguageModel.LanguageModel>, InvalidRuntimeConfig, Scope.Scope> =>
  Effect.map(Layer.build(liveLanguageModelLayer(options)), Layer.succeedContext)

export const withLiveLanguageModel = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  options: LiveTextProviderRuntimeOptions = {}
): Effect.Effect<A, E | InvalidRuntimeConfig, Exclude<R, LanguageModel.LanguageModel>> =>
  withLiveTextProvider(effect, options)
