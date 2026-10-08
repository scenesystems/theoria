/**
 * Optimizer-scoped generation settings for predictor requests.
 *
 * @since 0.7.0
 * @category internal
 * @internal
 */
import * as ModelSettings from "@scenesystems/effect-lm/ModelSettings"
import { Context } from "effect"

/**
 * Settings that override predictor parameters and invocation settings while an
 * optimizer runs a program, such as teacher settings and DSPy's retry temperature.
 * Predict merges them before forming its request, so automatic cache keys
 * contain the effective settings rather than the pre-binder ones.
 *
 * @since 0.7.0
 * @internal
 */
export const ScopedSettings = Context.Reference<ModelSettings.ModelSettings>(
  "@scenesystems/effect-dsp/internal/module/predict/scope/ScopedSettings",
  { defaultValue: () => ModelSettings.empty }
)
