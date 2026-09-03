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
  }
]

export const OPTION_DISCIPLINE_RULES = [
  {
    selector: "TSUnionType > TSUndefinedKeyword",
    message:
      "Do not model optionality with '| undefined'. Use Option<A> in runtime and Schema.optional/Schema.OptionFromSelf in schemas."
  },
  {
    selector: "CallExpression[callee.object.name='Option'][callee.property.name='getOrUndefined']",
    message:
      "Do not bridge Option to undefined. Stay in Option space with Option.match, Option.getOrElse, or Option.map."
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
  }
]
