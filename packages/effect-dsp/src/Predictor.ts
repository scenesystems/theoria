/**
 * Named predictors and trainable parameters within a program.
 * @since 0.6.0
 * @module
 */
import type { Effect } from "effect"
import { Chunk, Data, Schema } from "effect"
import type { Option } from "effect"
import type * as EffectRef from "effect/Ref"
import type { Codec } from "./Demonstration.js"
import type { SignatureError } from "./DspError.js"
import type { ModuleParameters } from "./ModuleParameters.js"
import type { Text } from "./Signature.js"

/** Dotted predictor path from the program root. @since 0.6.0 @category schemas */
export const Path = Schema.String.check(Schema.isPattern(/^[^.]+(?:\.[^.]+)*$/))
/** Predictor path. @since 0.6.0 @category models */
export type Path = typeof Path.Type

/** A parameter-bearing leaf, retaining alternate paths to the same predictor.
 * @since 0.6.0
 * @category models
 */
export class Predictor extends Data.Class<{
  readonly path: Path
  readonly name: string
  readonly aliases: Chunk.Chunk<Path>
  readonly frozen: boolean
  readonly signature: Text
  readonly signatureDigest: (parameters: ModuleParameters) => Effect.Effect<string, SignatureError>
  readonly parameters: EffectRef.Ref<ModuleParameters>
  readonly demonstrationCodec: Codec
  readonly boundParameters: Option.Option<ModuleParameters>
}> {}

/** Whether more than one program path reaches this predictor.
 * @since 0.6.0
 * @category predicates
 */
export const isShared = (predictor: Predictor): boolean => !Chunk.isEmpty(predictor.aliases)
