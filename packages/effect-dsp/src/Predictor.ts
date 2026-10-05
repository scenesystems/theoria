/**
 * Stable leaf identities and parameter ownership within a program.
 * @since 0.6.0
 * @module
 */
import type { Chunk } from "effect"
import { Data, Schema } from "effect"
import type { Option } from "effect"
import type * as EffectRef from "effect/Ref"
import type { Codec } from "./Demonstration.js"
import type { NodeSignature } from "./Module.js"
import type { ModuleParameters } from "./ModuleParameters.js"

/** Dotted declaration path from the program root. @since 0.6.0 @category schemas */
export const Id = Schema.String.check(Schema.isPattern(/^[^.]+(?:\.[^.]+)*$/))
/** Predictor path. @since 0.6.0 @category models */
export type Id = typeof Id.Type
/** Optimization ownership policy. @since 0.6.0 @category schemas */
export const Ownership = Schema.Literals(["owned", "shared", "frozen"])
/** Decoded ownership policy. @since 0.6.0 @category models */
export type Ownership = typeof Ownership.Type

/** One leaf owner, retaining alternate paths to the same parameter Ref.
 * @since 0.6.0
 * @category models
 */
export class Ref extends Data.Class<{
  readonly id: Id
  readonly name: string
  readonly aliases: Chunk.Chunk<Id>
  readonly ownership: Ownership
  readonly signature: NodeSignature
  readonly params: EffectRef.Ref<ModuleParameters>
  readonly demonstrationCodec: Codec
  readonly boundParameters: Option.Option<ModuleParameters>
}> {}
