/**
 * Extracts {@link FieldInfo} metadata from `Schema.Struct` field
 * declarations by inspecting the Schema AST property signatures.
 *
 * @since 0.1.0
 */
import { Array as Arr, Equal, Inspectable, Option, Predicate, Schema, SchemaAST } from "effect"
import { FieldDescriptionId, FieldInfo } from "../../Signature.js"

const descriptionFromPropertySignature = (propertySignature: SchemaAST.PropertySignature): Option.Option<string> =>
  Option.orElse(
    Option.filter(
      Option.fromNullishOr(Schema.resolveAnnotationsKey(Schema.make(propertySignature.type))?.[FieldDescriptionId]),
      Predicate.isString
    ),
    () =>
      Option.filter(
        Option.fromNullishOr(Schema.resolveAnnotations(Schema.make(propertySignature.type))?.[FieldDescriptionId]),
        Predicate.isString
      )
  )

const propertySignatures = (ast: SchemaAST.AST): ReadonlyArray<SchemaAST.PropertySignature> =>
  SchemaAST.isObjects(ast) ? ast.propertySignatures : Arr.empty()

/** Looks up a wire property's value schema without executing domain transformations. @internal */
export const encodedFieldSchema = <A>(
  schema: Schema.Schema<A>,
  name: string
): Option.Option<Schema.Codec<unknown, unknown, never, never>> =>
  Arr.findFirst(propertySignatures(schema.ast), (property) => Equal.equals(property.name, name)).pipe(
    Option.map((property) => Schema.toType(Schema.make(property.type)))
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
    isOptional: propertySignature.type.context?.isOptional ?? false
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
export const fieldsToInfoArray = (schema: Schema.Top) =>
  Arr.map(propertySignatures(Schema.toType(schema).ast), extractSingleFieldInfo)

/**
 * Projects each field's wire name and optionality while retaining its description.
 * Single-field projections keep renamed properties paired with their annotations
 * without assuming positional correspondence between two independently projected ASTs.
 *
 * @since 0.4.0
 * @category utils
 */
export const encodedFieldsToInfoArray = (schema: Schema.Top) =>
  Arr.map(propertySignatures(Schema.toEncoded(schema).ast), extractSingleFieldInfo)
