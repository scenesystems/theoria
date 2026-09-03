import { Array as Arr, Option } from "effect"
import {
  type DeclarationReflection,
  ReflectionKind,
  type SignatureReflection
} from "typedoc"

import {
  type ApiParameter,
  type ApiSignature
} from "@theoria/docs-model"
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
): string | null =>
  Option.getOrNull(Arr.findFirst(reflection.sources ?? [], (source) => source.url !== undefined).pipe(
    Option.flatMap((source) => Option.fromNullable(source.url))
  ))

const parameterModel = (
  parameter: NonNullable<SignatureReflection["parameters"]>[number],
  signature: SignatureReflection,
  context: ApiDocContext
): ApiParameter => ({
  name: parameter.name,
  type: parameter.type?.toString() ?? "unknown",
  optional: parameter.flags.isOptional,
  rest: parameter.flags.isRest,
  defaultValue: parameter.defaultValue ?? null,
  description: docParts(
    parameter.comment?.summary ?? signature.comment?.getIdentifiedTag(parameter.name, "@param")?.content,
    context
  )
})

const signatureKind = (signature: SignatureReflection): ApiSignature["kind"] =>
  signature.kindOf(ReflectionKind.ConstructorSignature) ? "constructor"
    : signature.kindOf(ReflectionKind.GetSignature) ? "get"
    : signature.kindOf(ReflectionKind.SetSignature) ? "set"
    : signature.kindOf(ReflectionKind.IndexSignature) ? "index"
    : "call"

const signatureModel = (
  signature: SignatureReflection,
  name: string,
  context: ApiDocContext,
  fallbackSourceUrl: string
): ApiSignature => {
  const parameters = Arr.map(signature.parameters ?? [], (parameter) =>
    parameterModel(parameter, signature, context))
  const parameterCode = Arr.map(parameters, (parameter) =>
    `${parameter.rest ? "..." : ""}${parameter.name}${parameter.optional && parameter.defaultValue === null ? "?" : ""}: ${
      parameter.type
    }${parameter.defaultValue === null ? "" : ` = ${parameter.defaultValue}`}`).join(", ")
  const genericCode = (signature.typeParameters?.length ?? 0) === 0
    ? ""
    : `<${Arr.map(signature.typeParameters ?? [], typeParameterCode).join(", ")}>`
  const returns = signature.type?.toString() ?? "void"
  const kind = signatureKind(signature)
  const code = kind === "constructor" ? `new ${genericCode}(${parameterCode}): ${returns}`
    : kind === "get" ? `get ${name}(): ${returns}`
    : kind === "set" ? `set ${name}(${parameterCode})`
    : kind === "index" ? `[${parameterCode}]: ${returns}`
    : `${name}${genericCode}(${parameterCode}): ${returns}`

  return {
    kind,
    code,
    typeParameters: typeParameters(signature.typeParameters, signature.comment, context),
    parameters,
    returns: { type: returns, description: tagParts(signature.comment, "@returns", context) },
    docs: documentation(signature.comment, context),
    sourceUrl: firstSourceUrl(signature) ?? fallbackSourceUrl
  }
}

const signaturesOf = (reflection: DeclarationReflection): ReadonlyArray<SignatureReflection> => {
  const direct = reflection.getAllSignatures()
  return direct.length > 0 ? direct
    : reflection.type?.type === "reflection" ? reflection.type.declaration.getAllSignatures()
    : []
}

export const signatureModels = (
  reflection: DeclarationReflection,
  name: string,
  context: ApiDocContext,
  fallbackSourceUrl: string
): ReadonlyArray<ApiSignature> =>
  Arr.map(signaturesOf(reflection), (signature) =>
    signatureModel(signature, name, context, fallbackSourceUrl))
