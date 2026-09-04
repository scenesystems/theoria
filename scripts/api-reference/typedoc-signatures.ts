import { Array as Arr, Option } from "effect"
import {
  type CommentDisplayPart,
  type DeclarationReflection,
  type ParameterReflection,
  ReflectionKind,
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
  Arr.findFirst(reflection.sources ?? [], (source) => Option.isSome(Option.fromNullable(source.url))).pipe(
    Option.flatMap((source) => Option.fromNullable(source.url))
  )

// A parameter is documented either on itself or through the signature's
// `@param <name>` tag.
const parameterSummary = (
  parameter: ParameterReflection,
  signature: SignatureReflection
): Option.Option<ReadonlyArray<CommentDisplayPart>> =>
  Option.fromNullable(parameter.comment).pipe(
    Option.map((present) => present.summary),
    Option.orElse(() =>
      Option.fromNullable(signature.comment).pipe(
        Option.flatMap((present) => Option.fromNullable(present.getIdentifiedTag(parameter.name, "@param"))),
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
  type: parameter.type?.toString() ?? "unknown",
  optional: parameter.flags.isOptional,
  rest: parameter.flags.isRest,
  defaultValue: Option.fromNullable(parameter.defaultValue),
  description: Option.match(parameterSummary(parameter, signature), {
    onNone: Arr.empty,
    onSome: (summary) => docParts(summary, context)
  })
})

const signatureKind = (signature: SignatureReflection): ApiSignature["kind"] =>
  signature.kindOf(ReflectionKind.ConstructorSignature) ?
    "constructor"
    : signature.kindOf(ReflectionKind.GetSignature) ?
    "get"
    : signature.kindOf(ReflectionKind.SetSignature) ?
    "set"
    : signature.kindOf(ReflectionKind.IndexSignature) ?
    "index"
    : "call"

const signatureModel = (
  signature: SignatureReflection,
  name: string,
  context: ApiDocContext,
  fallbackSourceUrl: string
): ApiSignature => {
  const parameters = Arr.map(signature.parameters ?? [], (parameter) => parameterModel(parameter, signature, context))
  const parameterCode = Arr.map(
    parameters,
    (parameter) =>
      `${parameter.rest ? "..." : ""}${parameter.name}${
        parameter.optional && Option.isNone(parameter.defaultValue) ? "?" : ""
      }: ${parameter.type}${
        Option.match(parameter.defaultValue, { onNone: () => "", onSome: (value) => ` = ${value}` })
      }`
  ).join(", ")
  const genericCode = (signature.typeParameters?.length ?? 0) === 0
    ? ""
    : `<${Arr.map(signature.typeParameters ?? [], typeParameterCode).join(", ")}>`
  const returns = signature.type?.toString() ?? "void"
  const kind = signatureKind(signature)
  const code = kind === "constructor" ?
    `new ${genericCode}(${parameterCode}): ${returns}`
    : kind === "get" ?
    `get ${name}(): ${returns}`
    : kind === "set" ?
    `set ${name}(${parameterCode})`
    : kind === "index" ?
    `[${parameterCode}]: ${returns}`
    : `${name}${genericCode}(${parameterCode}): ${returns}`

  return {
    kind,
    code,
    typeParameters: typeParameters(signature.typeParameters ?? [], Option.fromNullable(signature.comment), context),
    parameters,
    returns: { type: returns, description: tagParts(Option.fromNullable(signature.comment), "@returns", context) },
    docs: documentation(Option.fromNullable(signature.comment), context),
    sourceUrl: Option.getOrElse(firstSourceUrl(signature), () => fallbackSourceUrl)
  }
}

const signaturesOf = (reflection: DeclarationReflection): ReadonlyArray<SignatureReflection> => {
  const direct = reflection.getAllSignatures()
  return direct.length > 0 ?
    direct
    : reflection.type?.type === "reflection" ?
    reflection.type.declaration.getAllSignatures()
    : []
}

export const signatureModels = (
  reflection: DeclarationReflection,
  name: string,
  context: ApiDocContext,
  fallbackSourceUrl: string
): ReadonlyArray<ApiSignature> =>
  Arr.map(signaturesOf(reflection), (signature) => signatureModel(signature, name, context, fallbackSourceUrl))
