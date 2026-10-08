/**
 * Provider-independent generation settings.
 * @since 0.1.0
 * @module
 */
import { Context, Option, Schema } from "effect"

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

/** Resolved generation settings exposed by the active model binder.
 * @since 0.1.0
 * @category references
 */
export const Current = Context.Reference<ModelSettings>("@scenesystems/effect-lm/ModelSettings/Current", {
  defaultValue: () => empty
})

/** Defined override fields win; zero and empty stop lists are explicit values.
 * @since 0.1.0
 * @category combinators
 */
export const merge = (base: ModelSettings, override: ModelSettings): ModelSettings =>
  new ModelSettings({
    temperature: Option.fromNullishOr(override.temperature).pipe(Option.getOrElse(() => base.temperature)),
    maxTokens: Option.fromNullishOr(override.maxTokens).pipe(Option.getOrElse(() => base.maxTokens)),
    topP: Option.fromNullishOr(override.topP).pipe(Option.getOrElse(() => base.topP)),
    stop: Option.fromNullishOr(override.stop).pipe(Option.getOrElse(() => base.stop)),
    seed: Option.fromNullishOr(override.seed).pipe(Option.getOrElse(() => base.seed))
  })
