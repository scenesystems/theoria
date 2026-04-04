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
 * Extract a {@link FieldInfo} from a single `SchemaAST.PropertySignature`,
 * reading the {@link FieldDescriptionId} annotation for the description.
 *
 * @see {@link FieldInfo} — the returned metadata model
 * @see {@link FieldDescriptionId} — the annotation symbol read
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
 * Convert a `Schema.Struct.Fields` record into an array of
 * {@link FieldInfo} by extracting AST property signatures and
 * reading their annotations.
 *
 * @see {@link FieldInfo}
 * @see {@link extractSingleFieldInfo} — per-field extraction
 *
 * @since 0.1.0
 * @category utils
 */
export const fieldsToInfoArray = (fields: Schema.Struct.Fields): ReadonlyArray<FieldInfo> =>
  Arr.map(propertySignaturesFromFields(fields), extractSingleFieldInfo)
