/** Runtime composition of constructed structure and predictor metadata. @internal */
import type { Schema } from "effect"
import { Array as Arr, Option, Record, Struct } from "effect"
import type { ModuleParameters } from "../../ModuleParameters.js"
import { FieldInfo, Signature } from "../../Signature.js"

/** Apply parameter metadata without changing field types, names or order. @internal */
export const effective = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(
  signature: Signature<I, O>,
  params: ModuleParameters
): Signature<I, O> =>
  new Signature(Struct.assign(signature, {
    instructions: params.instructions,
    fields: Arr.map(signature.fields, (field) =>
      Option.match(Record.get(params.fields, field.name), {
        onNone: () => field,
        onSome: (metadata) =>
          new FieldInfo(Struct.assign(field, {
            prefix: Option.orElse(metadata.prefix, () => field.prefix),
            description: Option.orElse(metadata.description, () => field.description)
          }))
      }))
  }))
