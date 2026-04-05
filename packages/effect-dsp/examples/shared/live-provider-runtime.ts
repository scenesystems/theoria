/**
 * Shared live-provider runtime composition for examples.
 */
import type * as LanguageModel from "@effect/ai/LanguageModel"
import type { Effect, Layer } from "effect"

import { InvalidRuntimeConfig } from "../../../effect-inference/src/Errors/index.js"
import {
  type LiveTextProvider as LiveProvider,
  liveTextProviderLayer,
  type LiveTextProviderRuntimeOptions,
  type ResolvedLiveTextProviderRuntime as ResolvedLiveProviderConfig,
  resolveLiveTextProviderRuntime,
  withLiveTextProvider
} from "../../../effect-inference/src/Runtime/index.js"

export { InvalidRuntimeConfig as LiveProviderRuntimeError }

export type { LiveProvider, LiveTextProviderRuntimeOptions as LiveProviderRuntimeOptions, ResolvedLiveProviderConfig }

export const resolveLiveProviderConfig = resolveLiveTextProviderRuntime

export const liveLanguageModelLayer = (
  options: LiveTextProviderRuntimeOptions = {}
): Layer.Layer<LanguageModel.LanguageModel, InvalidRuntimeConfig, never> => liveTextProviderLayer(options)

export const withLiveLanguageModel = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  options: LiveTextProviderRuntimeOptions = {}
): Effect.Effect<A, E | InvalidRuntimeConfig, Exclude<R, LanguageModel.LanguageModel>> =>
  withLiveTextProvider(effect, options)
