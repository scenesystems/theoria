/**
 * Provider-independent generation settings.
 * @since 0.1.0
 * @module
 */
import { Schema } from "effect"

/** Generation overrides; omitted fields retain provider defaults.
 * @since 0.1.0
 * @category models
 */
export class ModelSettings extends Schema.Class<ModelSettings>("@scenesystems/effect-lm/ModelSettings")({
  temperature: Schema.optional(Schema.Finite),
  maxTokens: Schema.optional(Schema.Int),
  topP: Schema.optional(Schema.Finite),
  stop: Schema.optional(Schema.Array(Schema.String)),
  seed: Schema.optional(Schema.Int)
}) {}

/** No generation overrides. @since 0.1.0 @category constants */
export const empty = new ModelSettings({})

/** Defined override fields win; zero and empty stop lists are explicit values.
 * @since 0.1.0
 * @category combinators
 */
export const merge = (base: ModelSettings, override: ModelSettings): ModelSettings =>
  new ModelSettings({
    temperature: override.temperature ?? base.temperature,
    maxTokens: override.maxTokens ?? base.maxTokens,
    topP: override.topP ?? base.topP,
    stop: override.stop ?? base.stop,
    seed: override.seed ?? base.seed
  })
