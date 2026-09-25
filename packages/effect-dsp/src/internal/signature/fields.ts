/**
 * Extracts {@link FieldInfo} metadata from `Schema.Struct` field
 * declarations by inspecting the Schema AST property signatures.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean, Inspectable, Option, ParseResult, Record, Schema, SchemaAST, String } from "effect"
import { FieldDescriptionId, FieldInfo } from "../../Signature.js"

const descriptionEquivalence = Option.getEquivalence(String.Equivalence)

// FieldInfo has no constructor defaults. Defer its complete type-side validator
// through the public Signature module's circular import, not individual values.
const validateFieldInfo = ParseResult.validateSync(Schema.suspend(() =>
  Schema.Struct(FieldInfo.fields).annotations({
    title: String.concat(FieldInfo.identifier, " (Constructor)")
  })
))

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
  new FieldInfo(
    validateFieldInfo({
      name: Inspectable.toStringUnknown(propertySignature.name),
      description: descriptionFromPropertySignature(propertySignature),
      isOptional: propertySignature.isOptional
    }),
    { disableValidation: true }
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
export const fieldsToInfoArray = <F extends Schema.Struct.Fields>(schema: Schema.Struct<F>) =>
  Arr.map(SchemaAST.getPropertySignatures(SchemaAST.typeAST(schema.ast)), extractSingleFieldInfo)

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
    const declaration = Schema.Struct(Record.singleton(name, field))
    const description = Arr.head(SchemaAST.getPropertySignatures(SchemaAST.typeAST(declaration.ast))).pipe(
      Option.flatMap(descriptionFromPropertySignature)
    )
    return Arr.map(
      SchemaAST.getPropertySignatures(SchemaAST.encodedBoundAST(declaration.ast)),
      (property) => {
        const info = extractSingleFieldInfo(property)
        const resolvedDescription = Option.orElse(description, () => info.description)
        return Boolean.match(descriptionEquivalence(info.description, resolvedDescription), {
          onTrue: () => info,
          onFalse: () =>
            new FieldInfo(validateFieldInfo({ ...info, description: resolvedDescription }), { disableValidation: true })
        })
      }
    )
  })
