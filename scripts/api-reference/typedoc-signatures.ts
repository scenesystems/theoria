import { Array as Arr, Boolean as Bool, Match, Option, String as Str } from "effect"
import {
  type CommentDisplayPart,
  type DeclarationReflection,
  type ParameterReflection,
  ReflectionKind,
  type ReflectionType,
  type SignatureReflection
} from "typedoc"

import { type ApiParameter, type ApiSignature } from "@theoria/docs-model"
import {
  type ApiDocContext,
  docParts,
  documentation,
  tagParts,
  typeParameterCode,
  typeParameters
} from "./typedoc-comments.js"

export const firstSourceUrl = (
  reflection: DeclarationReflection | SignatureReflection
): Option.Option<string> =>
  Arr.findFirst(
    Option.fromNullishOr(reflection.sources).pipe(Option.getOrElse(Arr.empty)),
    (source) => Option.isSome(Option.fromNullishOr(source.url))
  ).pipe(
    Option.flatMap((source) => Option.fromNullishOr(source.url))
  )

// A parameter is documented either on itself or through the signature's
// `@param <name>` tag.
const parameterSummary = (
  parameter: ParameterReflection,
  signature: SignatureReflection
): Option.Option<ReadonlyArray<CommentDisplayPart>> =>
  Option.fromNullishOr(parameter.comment).pipe(
    Option.map((present) => present.summary),
    Option.orElse(() =>
      Option.fromNullishOr(signature.comment).pipe(
        Option.flatMap((present) => Option.fromNullishOr(present.getIdentifiedTag(parameter.name, "@param"))),
        Option.map((tag) => tag.content)
      )
    )
  )

const parameterModel = (
  parameter: ParameterReflection,
  signature: SignatureReflection,
  context: ApiDocContext
): ApiParameter => ({
  name: parameter.name,
  type: Option.fromNullishOr(parameter.type).pipe(
    Option.map((type) => type.toString()),
    Option.getOrElse(() => "unknown")
  ),
  optional: parameter.flags.isOptional,
  rest: parameter.flags.isRest,
  defaultValue: Option.fromNullishOr(parameter.defaultValue),
  description: Option.match(parameterSummary(parameter, signature), {
    onNone: Arr.empty,
    onSome: (summary) => docParts(summary, context)
  })
})

const signatureKind = (signature: SignatureReflection): ApiSignature["kind"] =>
  Bool.match(signature.kindOf(ReflectionKind.ConstructorSignature), {
    onTrue: (): ApiSignature["kind"] => "constructor",
    onFalse: () =>
      Bool.match(signature.kindOf(ReflectionKind.GetSignature), {
        onTrue: (): ApiSignature["kind"] => "get",
        onFalse: () =>
          Bool.match(signature.kindOf(ReflectionKind.SetSignature), {
            onTrue: (): ApiSignature["kind"] => "set",
            onFalse: () =>
              Bool.match(signature.kindOf(ReflectionKind.IndexSignature), {
                onTrue: (): ApiSignature["kind"] => "index",
                onFalse: (): ApiSignature["kind"] => "call"
              })
          })
      })
  })

const signatureModel = (
  signature: SignatureReflection,
  name: string,
  context: ApiDocContext,
  fallbackSourceUrl: string
): ApiSignature => {
  const parameters = Arr.map(
    Option.fromNullishOr(signature.parameters).pipe(Option.getOrElse(Arr.empty)),
    (parameter) => parameterModel(parameter, signature, context)
  )
  const parameterCode = Arr.join(
    Arr.map(
      parameters,
      (parameter) =>
        `${Bool.match(parameter.rest, { onTrue: () => "...", onFalse: () => "" })}${parameter.name}${
          Bool.match(Bool.and(parameter.optional, Option.isNone(parameter.defaultValue)), {
            onTrue: () => "?",
            onFalse: () => ""
          })
        }: ${parameter.type}${
          Option.match(parameter.defaultValue, { onNone: () => "", onSome: (value) => ` = ${value}` })
        }`
    ),
    ", "
  )
  const signatureTypeParameters = Option.fromNullishOr(signature.typeParameters).pipe(Option.getOrElse(Arr.empty))
  const genericCode = Bool.match(Arr.isReadonlyArrayEmpty(signatureTypeParameters), {
    onTrue: () => "",
    onFalse: () => `<${Arr.join(Arr.map(signatureTypeParameters, typeParameterCode), ", ")}>`
  })
  const returns = Option.fromNullishOr(signature.type).pipe(
    Option.map((type) => type.toString()),
    Option.getOrElse(() => "void")
  )
  const kind = signatureKind(signature)
  const code = Match.value(kind).pipe(
    Match.when("constructor", () => `new ${genericCode}(${parameterCode}): ${returns}`),
    Match.when("get", () => `get ${name}(): ${returns}`),
    Match.when("set", () => `set ${name}(${parameterCode})`),
    Match.when("index", () => `[${parameterCode}]: ${returns}`),
    Match.when("call", () => `${name}${genericCode}(${parameterCode}): ${returns}`),
    Match.exhaustive
  )

  return {
    kind,
    code,
    typeParameters: typeParameters(signatureTypeParameters, Option.fromNullishOr(signature.comment), context),
    parameters,
    returns: { type: returns, description: tagParts(Option.fromNullishOr(signature.comment), "@returns", context) },
    docs: documentation(Option.fromNullishOr(signature.comment), context),
    sourceUrl: Option.getOrElse(firstSourceUrl(signature), () => fallbackSourceUrl)
  }
}

const signaturesOf = (reflection: DeclarationReflection): ReadonlyArray<SignatureReflection> => {
  const direct = reflection.getAllSignatures()
  return Bool.match(Arr.isReadonlyArrayNonEmpty(direct), {
    onTrue: () => direct,
    onFalse: () =>
      Option.fromNullishOr(reflection.type).pipe(
        Option.filter((type): type is ReflectionType => Str.Equivalence(type.type, "reflection")),
        Option.map((type) => type.declaration.getAllSignatures()),
        Option.getOrElse(Arr.empty)
      )
  })
}

export const signatureModels = (
  reflection: DeclarationReflection,
  name: string,
  context: ApiDocContext,
  fallbackSourceUrl: string
): ReadonlyArray<ApiSignature> =>
  Arr.map(signaturesOf(reflection), (signature) => signatureModel(signature, name, context, fallbackSourceUrl))
