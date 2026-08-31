import { Array as Arr, Effect, Option } from "effect"
import {
  type DeclarationReflection,
  type Reflection,
  ReflectionKind
} from "typedoc"

import {
  ApiReferenceGenerationError,
  type ApiReferenceImport,
  type ApiReferenceRoute
} from "./model.js"
import {
  type ApiExport,
  type ApiFacet,
  type ApiMember,
  type ApiSignature
} from "./presentation-model.js"
import { apiExportAnchor, apiExportId } from "./presentation.js"
import {
  type ApiDocContext,
  documentation,
  typeParameterCode,
  typeParameters
} from "./typedoc-comments.js"
import { firstSourceUrl, signatureModels } from "./typedoc-signatures.js"

const reflectionKind = (reflection: Reflection): string =>
  typeof ReflectionKind[reflection.kind] === "string"
    ? `${ReflectionKind[reflection.kind]}`.replace(/([a-z])([A-Z])/gu, "$1-$2").toLowerCase()
    : "declaration"

const membersOf = (reflection: DeclarationReflection): ReadonlyArray<DeclarationReflection> => {
  const candidates = (reflection.children?.length ?? 0) > 0 ? reflection.children ?? []
    : reflection.type?.type === "reflection" ? reflection.type.declaration.children ?? []
    : []
  return Arr.filter(candidates, (member) =>
    !member.flags.isPrivate && !member.flags.isProtected && (
      firstSourceUrl(member) !== null || (!member.flags.isInherited && !member.flags.isExternal)
    ))
}

const memberModel = (
  member: DeclarationReflection,
  exportName: string,
  context: ApiDocContext,
  fallbackSourceUrl: string
): ApiMember => {
  const sourceUrl = firstSourceUrl(member)
  const signatures = signatureModels(member, member.name, context, sourceUrl ?? fallbackSourceUrl)
  const type = member.type?.toString() ?? null
  const declaration = signatures.length > 0 ? Arr.map(signatures, (signature) => signature.code).join("\n")
    : `${member.flags.isStatic ? "static " : ""}${member.flags.isReadonly ? "readonly " : ""}${member.name}${
      member.flags.isOptional ? "?" : ""
    }${type === null ? "" : `: ${type}`}${member.defaultValue === undefined ? "" : ` = ${member.defaultValue}`}`

  return {
    name: member.name,
    anchor: `${apiExportAnchor(exportName)}-${encodeURIComponent(member.name)}`,
    kind: reflectionKind(member),
    declaration,
    type,
    optional: member.flags.isOptional,
    readonly: member.flags.isReadonly,
    static: member.flags.isStatic,
    inherited: member.flags.isInherited,
    docs: documentation(member.comment, context),
    signatures,
    sourceUrl: sourceUrl ?? fallbackSourceUrl
  }
}

const declarationCode = (
  reflection: DeclarationReflection,
  signatures: ReadonlyArray<ApiSignature>
): string => {
  const generics = (reflection.typeParameters?.length ?? 0) === 0 ? ""
    : `<${Arr.map(reflection.typeParameters ?? [], typeParameterCode).join(", ")}>`
  const extended = reflection.extendedTypes?.length
    ? ` extends ${Arr.map(reflection.extendedTypes, (type) => type.toString()).join(", ")}` : ""
  const implemented = reflection.implementedTypes?.length
    ? ` implements ${Arr.map(reflection.implementedTypes, (type) => type.toString()).join(", ")}` : ""
  if (reflection.kindOf(ReflectionKind.Function) || signatures.length > 0) {
    return Arr.map(signatures, (signature) => signature.code).join("\n")
  }
  if (reflection.kindOf(ReflectionKind.Class)) return `class ${reflection.name}${generics}${extended}${implemented}`
  if (reflection.kindOf(ReflectionKind.Interface)) return `interface ${reflection.name}${generics}${extended}`
  if (reflection.kindOf(ReflectionKind.TypeAlias)) return `type ${reflection.name}${generics} = ${reflection.type?.toString() ?? "unknown"}`
  if (reflection.kindOf(ReflectionKind.Variable)) return `${reflection.flags.isConst ? "const" : "let"} ${reflection.name}: ${reflection.type?.toString() ?? "unknown"}`
  if (reflection.kindOf(ReflectionKind.Enum)) return `enum ${reflection.name}`
  if (reflection.kindOf([ReflectionKind.Namespace, ReflectionKind.Module])) return `namespace ${reflection.name}`
  return `${reflectionKind(reflection)} ${reflection.name}`
}

const facetModel = (
  reflection: DeclarationReflection,
  context: ApiDocContext,
  sourceUrl: string
): ApiFacet => {
  const signatures = signatureModels(reflection, reflection.name, context, sourceUrl)
  return {
    kind: reflectionKind(reflection),
    declaration: declarationCode(reflection, signatures),
    type: reflection.type?.toString() ?? null,
    typeParameters: typeParameters(reflection.typeParameters, reflection.comment, context),
    extends: Arr.map(reflection.extendedTypes ?? [], (type) => type.toString()),
    implements: Arr.map(reflection.implementedTypes ?? [], (type) => type.toString()),
    docs: documentation(reflection.comment, context),
    signatures,
    members: Arr.map(membersOf(reflection), (member) => memberModel(member, reflection.name, context, sourceUrl)),
    sourceUrl
  }
}

const exportModel = (
  packageName: string,
  packageSlug: string,
  moduleReflection: DeclarationReflection,
  route: ApiReferenceRoute,
  context: ApiDocContext,
  entry: ApiReferenceImport
) =>
  Effect.map(
    Effect.forEach(entry.reflections, (facet) =>
      Option.match(
        Arr.findFirst(moduleReflection.children ?? [], (reflection) => reflection.id === facet.reflectionId),
        {
          onNone: () => Effect.fail(new ApiReferenceGenerationError({
            packageName,
            detail: `${route.subpath} export ${entry.name} reflection ${String(facet.reflectionId)} is missing`
          })),
          onSome: (reflection) => Effect.succeed(facetModel(reflection, context, facet.sourceUrl))
        }
      )),
    (facets): ApiExport => ({
      id: apiExportId(packageSlug, route.slug, entry.name),
      name: entry.name,
      anchor: apiExportAnchor(entry.name),
      importKind: entry.importKind,
      category: entry.category,
      since: entry.since,
      summary: entry.summary,
      facets
    })
  )

export const apiExports = (
  packageName: string,
  packageSlug: string,
  moduleReflection: DeclarationReflection,
  route: ApiReferenceRoute,
  context: ApiDocContext
) =>
  Effect.forEach(route.imports, (entry) => exportModel(
    packageName,
    packageSlug,
    moduleReflection,
    route,
    context,
    entry
  ))
