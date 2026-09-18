/**
 * Shared live-provider runtime composition for examples.
 */
import type * as LanguageModel from "@effect/ai/LanguageModel"
import { Effect, Layer, type Scope } from "effect"

import { InvalidRuntimeConfig } from "@scenesystems/effect-inference/InferenceError"
import * as TextProvider from "@scenesystems/effect-inference/TextProvider"

export { InvalidRuntimeConfig as LiveProviderRuntimeError }

export type LiveProvider = TextProvider.Provider
export type LiveProviderRuntimeOptions = TextProvider.Options
export type ResolvedLiveProviderConfig = TextProvider.Runtime

export const resolveLiveProviderConfig = TextProvider.resolve

export const liveLanguageModelLayer = (
  options: TextProvider.Options = new TextProvider.Options({})
): Layer.Layer<LanguageModel.LanguageModel, InvalidRuntimeConfig, never> => TextProvider.layerConfig(options)

/** Builds the fallible live provider once and exposes its services as an infallible teacher layer. */
export const liveTeacherLayer = (
  options: TextProvider.Options = new TextProvider.Options({})
): Effect.Effect<Layer.Layer<LanguageModel.LanguageModel>, InvalidRuntimeConfig, Scope.Scope> =>
  Effect.map(Layer.build(liveLanguageModelLayer(options)), Layer.succeedContext)

export const withLiveLanguageModel = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  options: TextProvider.Options = new TextProvider.Options({})
): Effect.Effect<A, E | InvalidRuntimeConfig, Exclude<R, LanguageModel.LanguageModel>> =>
  Effect.provide(effect, TextProvider.layerConfig(options))
