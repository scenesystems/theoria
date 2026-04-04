/**
 * Core `Module` class and `SavedState` envelope for parameter persistence.
 *
 * @since 0.1.0
 */
import type * as AiError from "@effect/ai/AiError"
import type * as LanguageModel from "@effect/ai/LanguageModel"
import { Data, Schema } from "effect"
import type { Effect, HashMap, Ref } from "effect"
import type { ModuleId } from "../contracts/ModuleId.js"
import type { ModuleNode } from "../contracts/ModuleNode.js"
import { ModuleParams } from "../contracts/ModuleParams.js"
import type { DspError } from "../Errors/union.js"
import type { Signature } from "../Signature/model.js"

/**
 * Serialized program state capturing version, per-module parameters, and
 * optional metadata. Use with `Module.save` and `Module.load` to persist
 * and restore learned parameters across runs.
 *
 * @see {@link Module}
 *
 * @since 0.1.0
 * @category models
 */
export class SavedState extends Schema.Class<SavedState>("ProgramParams")({
  version: Schema.Literal(1),
  modules: Schema.Array(Schema.Struct({
    name: Schema.String,
    params: ModuleParams
  })),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
}) {}

/**
 * The core runtime contract for a learnable LLM program. Each module owns
 * a typed `forward` function that transforms schema-validated input into
 * schema-validated output via a language model. Module parameters
 * (instructions and demonstrations) are mutable via `Ref` and can be
 * tuned by optimizers.
 *
 * @see {@link Signature}
 * @see {@link ModuleParams}
 * @see {@link SavedState}
 *
 * @since 0.1.0
 * @category models
 */
export class Module<
  I extends Schema.Struct.Fields = Schema.Struct.Fields,
  O extends Schema.Struct.Fields = Schema.Struct.Fields
> extends Data.TaggedClass("Module")<{
  readonly name: string
  readonly signature: Signature<I, O>
  readonly params: Ref.Ref<ModuleParams>
  readonly subModules: HashMap.HashMap<ModuleId, ModuleNode>
  readonly forward: (
    input: Schema.Schema.Type<Schema.Struct<I>>
  ) => Effect.Effect<
    Schema.Schema.Type<Schema.Struct<O>>,
    AiError.AiError | DspError,
    | LanguageModel.LanguageModel
    | Schema.Schema.Context<Schema.Struct<I>>
    | Schema.Schema.Context<Schema.Struct<O>>
  >
}> {}
