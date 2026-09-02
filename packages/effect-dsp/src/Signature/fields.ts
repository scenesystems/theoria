/**
 * Extracts {@link FieldInfo} metadata from `Schema.Struct` field
 * declarations by inspecting the Schema AST property signatures.
 *
 * @since 0.1.0
 */
import { Array as Arr, Match, Option, Schema, SchemaAST } from "effect"
import { FieldDescriptionId } from "./annotations.js"
import { FieldInfo } from "./model.js"

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
    name: String(propertySignature.name),
    description: descriptionFromPropertySignature(propertySignature),
    isOptional: propertySignature.isOptional
  })

const propertySignaturesFromFields = (fields: Schema.Struct.Fields): ReadonlyArray<SchemaAST.PropertySignature> =>
  Match.value(Schema.Struct(fields).ast).pipe(
    Match.when(SchemaAST.isTypeLiteral, (typeLiteral) => typeLiteral.propertySignatures),
    Match.orElse(() => Arr.empty<SchemaAST.PropertySignature>())
  )

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
export const fieldsToInfoArray = (fields: Schema.Struct.Fields): ReadonlyArray<FieldInfo> =>
  Arr.map(propertySignaturesFromFields(fields), extractSingleFieldInfo)
