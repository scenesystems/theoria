/**
 * Extracts {@link FieldInfo} metadata from `Schema.Struct` field
 * declarations by inspecting the Schema AST property signatures.
 *
 * @since 0.1.0
 */
import { Array as Arr, Inspectable, Option, Record, Schema, SchemaAST } from "effect"
import { FieldDescriptionId, FieldInfo } from "../../Signature.js"

const descriptionFromPropertySignature = (propertySignature: SchemaAST.PropertySignature): Option.Option<string> =>
  Option.orElse(
    SchemaAST.getAnnotation<string>(FieldDescriptionId)(propertySignature),
    () => SchemaAST.getAnnotation<string>(FieldDescriptionId)(propertySignature.type)
  )

/**
 * Extracts field metadata and its optional description annotation from one AST
 * property signature.
 *
 * @since 0.1.0
 * @category utils
 */
export const extractSingleFieldInfo = (
  propertySignature: SchemaAST.PropertySignature
): FieldInfo =>
  new FieldInfo({
    name: Inspectable.toStringUnknown(propertySignature.name),
    description: descriptionFromPropertySignature(propertySignature),
    isOptional: propertySignature.isOptional
  })

/**
 * Converts struct fields to metadata in AST property order.
 *
 * @remarks
 * Descriptions come from {@link FieldDescriptionId} annotations on each
 * property signature or its value schema.
 *
 * @since 0.1.0
 * @category utils
 */
export const fieldsToInfoArray = (fields: Schema.Struct.Fields) =>
  Arr.map(SchemaAST.getPropertySignatures(Schema.typeSchema(Schema.Struct(fields)).ast), extractSingleFieldInfo)

/**
 * Projects each field's wire name and optionality while retaining its description.
 * Single-field projections keep renamed properties paired with their annotations
 * without assuming positional correspondence between two independently projected ASTs.
 *
 * @since 0.4.0
 * @category utils
 */
export const encodedFieldsToInfoArray = (fields: Schema.Struct.Fields) =>
  Arr.flatMap(Record.toEntries(fields), ([name, field]) => {
    const declaration = Record.singleton(name, field)
    const description = Arr.head(fieldsToInfoArray(declaration)).pipe(Option.flatMap((info) => info.description))
    return Arr.map(
      SchemaAST.getPropertySignatures(Schema.encodedBoundSchema(Schema.Struct(declaration)).ast),
      (property) =>
        new FieldInfo({
          ...extractSingleFieldInfo(property),
          description: Option.orElse(description, () => descriptionFromPropertySignature(property))
        })
    )
  })
