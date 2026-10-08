/**
 * Declared provider and model identity for durable request caching.
 * @since 0.1.0
 * @module
 */
import { Context, Option, Schema } from "effect"

/** Provider-selected model identity, independent of generation settings.
 * @since 0.1.0
 * @category models
 */
export class Identity extends Schema.Class<Identity>("@scenesystems/effect-lm/ModelIdentity")({
  provider: Schema.String,
  model: Schema.String
}) {}

/** Identity of the model supplied by the active binder, when declared.
 * @since 0.1.0
 * @category services
 */
export const Current = Context.Reference<Option.Option<Identity>>(
  "@scenesystems/effect-lm/ModelIdentity/Current",
  { defaultValue: Option.none }
)
