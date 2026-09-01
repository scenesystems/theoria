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
 * Schema for the version-1 parameter envelope accepted by {@link load} and
 * produced by {@link save}. Compatibility is structural: loading requires
 * exactly one entry for every module name in the target module tree, rejects
 * unknown or duplicate names, and currently accepts only `version: 1`.
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
 * Runtime contract for a named program node.
 *
 * @remarks
 * `forward` accepts the decoded
 * input type and returns the decoded output type. Its environment contains
 * `LanguageModel` plus any input/output Schema context, and its typed failure
 * channel is `AiError | DspError`.
 * `params` is this node's mutable instruction/demonstration state.
 * `subModules` describes owned child nodes for composition, discovery, and
 * persistence; wrappers with an operational inner module do not necessarily
 * expose that inner module in this map.
 *
 * @typeParam I - Input fields controlling the accepted decoded input and Schema context.
 * @typeParam O - Output fields controlling the decoded result and Schema context.
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
