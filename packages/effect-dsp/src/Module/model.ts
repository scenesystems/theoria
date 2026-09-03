/**
 * Executable module nodes and their parameter snapshot envelope.
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
 * Captures module parameter values in the version 1 persistence envelope.
 *
 * @remarks
 * Schema decoding accepts only version `1`. {@link load} additionally requires
 * exactly one entry for each name in the target parameter tree and rejects
 * duplicate, missing, or unknown names. Metadata is preserved by the schema but
 * ignored by `load`; `save` omits it.
 *
 * @since 0.1.0
 * @category models
 */
export class SavedState extends Schema.Class<SavedState>("ProgramParams")({
  /** Envelope format version; only `1` is accepted. */
  version: Schema.Literal(1),
  /** Parameter entries matched to a target module tree by exact name. */
  modules: Schema.Array(
    Schema.Struct({
      /** Module name used by persistence matching. */
      name: Schema.String,
      /** Complete parameter value restored into the module ref. */
      params: ModuleParams
    })
  ),
  /** Caller-defined envelope metadata ignored by module restoration. */
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
}) {}

/**
 * Binds a decoded signature to mutable parameters and an executable operation.
 *
 * @remarks
 * The signature determines compile-time input and output types. `forward` does
 * not promise to decode untrusted input before execution; callers crossing an
 * untyped boundary must decode with `signature.inputSchema`. Each implementation
 * may use a language-model service and any Schema context, and may fail with an
 * AI provider error or package-owned `DspError`.
 *
 * Parameters remain mutable through a `Ref`. The child map records owned nodes
 * for composition, discovery, and persistence, but operational wrappers do not
 * necessarily expose the module they invoke as a child.
 *
 * @typeParam I - Fields defining decoded input and input Schema requirements.
 * @typeParam O - Fields defining decoded output and output Schema requirements.
 *
 * @since 0.1.0
 * @category models
 */
export class Module<
  I extends Schema.Struct.Fields = Schema.Struct.Fields,
  O extends Schema.Struct.Fields = Schema.Struct.Fields
> extends Data.TaggedClass("Module")<{
  /** Name used by discovery, tracing, and parameter persistence. */
  readonly name: string
  /** Runtime schemas and prompt metadata for this module boundary. */
  readonly signature: Signature<I, O>
  /** Mutable instruction, demonstration, rendering, and generation state. */
  readonly params: Ref.Ref<ModuleParams>
  /** Child nodes owned for composition and parameter persistence. */
  readonly subModules: HashMap.HashMap<ModuleId, ModuleNode>
  /** Executes the module for one already-decoded input value. */
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
