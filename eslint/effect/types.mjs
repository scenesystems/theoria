/**
 * Type-level discipline: no assertions, no TypeScript utility types over
 * schema-derived types, no module stubs or tacit composition, and the
 * schema-first modeling rules that only library code carries.
 *
 * @module eslint/effect/types
 */

export const TYPE_ASSERTION_RULES = [
  {
    selector: "TSAsExpression",
    message: "Do not use 'as' type assertions. Use Schema.decodeUnknown for runtime validation."
  },
  {
    selector: "TSAsExpression[expression.type='TSAsExpression']",
    message: "Do not use double 'as' assertions. Use Schema.decodeUnknown."
  },
  { selector: "TSSatisfiesExpression", message: "Do not use 'satisfies'. Use Schema.is or Schema.decodeUnknown." }
]

export const UTILITY_TYPE_RULES = [
  {
    selector: "TSTypeReference[typeName.name='ReturnType']",
    message: "Do not use 'ReturnType<>'. Derive types from Schema instead."
  },
  {
    selector: "TSTypeReference[typeName.name='InstanceType']",
    message: "Do not use 'InstanceType<>'. Derive types from Schema instead."
  },
  {
    selector: "TSTypeReference[typeName.name='Awaited']",
    message: "Do not use 'Awaited<>'. Use Effect types directly."
  },
  {
    selector: "TSTypeReference[typeName.name='Parameters']",
    message: "Do not use 'Parameters<>'. Use Schema types or explicit types."
  },
  {
    selector: "TSTypeReference[typeName.name='Partial']",
    message: "Do not use 'Partial<>'. Use Schema.partial instead."
  },
  { selector: "TSTypeReference[typeName.name='Pick']", message: "Do not use 'Pick<>'. Use Schema.pick instead." },
  { selector: "TSTypeReference[typeName.name='Omit']", message: "Do not use 'Omit<>'. Use Schema.omit instead." },
  {
    selector: "TSTypeReference[typeName.name='Required']",
    message: "Do not use 'Required<>'. Use Schema.required instead."
  }
]

export const MODULE_STUB_RULES = [
  {
    selector: "ExportNamedDeclaration[declaration=null][source=null][specifiers.length=0]",
    message:
      "Do not leave empty 'export {}' module stubs. Implement the module or remove the file from the public/internal graph."
  }
]

export const TACIT_USAGE_RULES = [
  {
    selector: "CallExpression[callee.name='flow']",
    message: "Do not use flow(). Use explicit arrow functions: (x) => fn2(fn1(x))."
  },
  {
    selector: "ImportDeclaration[source.value='effect'] ImportSpecifier[imported.name='flow']",
    message: "Do not import 'flow' from effect. Use explicit arrow functions instead."
  }
]

export const TYPE_MODELING_RULES = [
  {
    selector: "TSInterfaceDeclaration",
    message:
      "Do not use TypeScript interfaces. Model runtime contracts with Schema.Class, Schema.TaggedClass, or Data.TaggedClass."
  },
  {
    selector: "TSTypeAliasDeclaration[typeAnnotation.type='TSTypeLiteral']",
    message:
      "Do not use object-literal type aliases as runtime carriers. Promote to Schema.Class/Data.Class or a schema-derived type alias."
  },
  {
    selector: "TSTypeAliasDeclaration[typeAnnotation.type='TSConditionalType']",
    message:
      "Do not use conditional helper type aliases for runtime contracts. Derive from canonical Schema values instead."
  },
  {
    selector:
      "TSTypeAliasDeclaration[typeAnnotation.type='TSTypeReference'][typeAnnotation.typeName.type='TSQualifiedName'][typeAnnotation.typeName.left.name='Data'][typeAnnotation.typeName.right.name='TaggedEnum']",
    message:
      "Do not define event contracts as type aliases over Data.TaggedEnum. Use schema-backed runtime models or tagged class values."
  },
  {
    selector: "TSTypeReference[typeName.name='Readonly'] > TSTypeParameterInstantiation > TSTypeLiteral",
    message:
      "Do not wrap object literals in Readonly<{}>. Model records with Schema.Struct (type X = typeof X.Type) or Data.Class."
  },
  {
    selector: "TSTypeAliasDeclaration > TSIntersectionType > TSTypeLiteral",
    message:
      "Do not intersect object literals into a type alias. Extend the Schema.Struct or Data.Class that owns the record."
  }
]

export const OPTION_DISCIPLINE_RULES = [
  {
    selector: "TSUnionType > TSUndefinedKeyword",
    message:
      "Do not model optionality with '| undefined'. Use Option<A> in runtime and Schema.optional/Schema.OptionFromSelf in schemas."
  },
  {
    selector: "MemberExpression[object.name=/^(Option|Either)$/][property.name=/^getOr(Null|Undefined)$/]",
    message:
      "Do not bridge Option or Either to null/undefined. Stay in Option/Either space with match, map, or getOrElse; encode absence at JSON boundaries with Schema.OptionFromNullOr."
  },
  {
    selector: "BinaryExpression[operator='==='][left.type='Identifier'][left.name='undefined']",
    message: "Do not compare with undefined. Model absence with Option and pattern-match instead."
  },
  {
    selector: "BinaryExpression[operator='==='][right.type='Identifier'][right.name='undefined']",
    message: "Do not compare with undefined. Model absence with Option and pattern-match instead."
  },
  {
    selector: "BinaryExpression[operator='!=='][left.type='Identifier'][left.name='undefined']",
    message: "Do not compare with undefined. Model absence with Option and pattern-match instead."
  },
  {
    selector: "BinaryExpression[operator='!=='][right.type='Identifier'][right.name='undefined']",
    message: "Do not compare with undefined. Model absence with Option and pattern-match instead."
  },
  {
    selector:
      "BinaryExpression[left.type='UnaryExpression'][left.operator='typeof'] > Literal.right[value='undefined']",
    message:
      "Do not probe with typeof x === 'undefined'. Provide the capability as a service or lift it with Option.fromNullable."
  },
  {
    selector:
      "BinaryExpression[right.type='UnaryExpression'][right.operator='typeof'] > Literal.left[value='undefined']",
    message:
      "Do not probe with 'undefined' === typeof x. Provide the capability as a service or lift it with Option.fromNullable."
  },
  {
    selector: "TSTypeAnnotation > TSUnionType > TSNullKeyword",
    message:
      "Do not model absence with '| null'. Use Option<A>; at JSON boundaries decode with Schema.OptionFromNullOr."
  },
  {
    selector: "TSTypeParameterInstantiation > TSUnionType > TSNullKeyword",
    message:
      "Do not model absence with '| null'. Use Option<A>; at JSON boundaries decode with Schema.OptionFromNullOr."
  },
  {
    selector: "BinaryExpression[operator=/^[!=]==$/] > Literal[raw='null']",
    message: "Do not compare with null. Lift the value with Option.fromNullable or test it with Predicate.isNull."
  },
  {
    selector: "LogicalExpression[operator='??'] > Literal.right[raw='null']",
    message: "Do not default to null with '?? null'. Lift the value with Option.fromNullable."
  },
  {
    selector: "Property[key.name='onNone'] > ArrowFunctionExpression[body.type='Identifier'][body.name='undefined']",
    message: "Do not bridge Option to undefined in onNone. Keep the Option or accept Option<A> in the callee."
  },
  {
    selector:
      "CallExpression[callee.object.name='Option'][callee.property.name='getOrElse'] > ArrowFunctionExpression[body.type='Identifier'][body.name='undefined']",
    message: "Do not bridge Option to undefined with getOrElse. Keep the Option or accept Option<A> in the callee."
  }
]
