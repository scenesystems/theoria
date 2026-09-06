import { Array as Arr, Effect, Option } from "effect"
import { type DeclarationReflection, type Reflection, ReflectionKind } from "typedoc"

import { type ApiDocPart, type ApiExport, type ApiFacet, type ApiMember, type ApiSignature } from "@theoria/docs-model"
import { ApiReferenceGenerationError, type ApiReferenceImport, type ApiReferenceRoute } from "./model.js"
import { apiExportAnchor, apiExportId } from "./presentation.js"
import { type ApiDocContext, documentation, typeParameterCode, typeParameters } from "./typedoc-comments.js"
import { firstSourceUrl, signatureModels } from "./typedoc-signatures.js"

const reflectionKind = (reflection: Reflection): string =>
  typeof ReflectionKind[reflection.kind] === "string"
    ? `${ReflectionKind[reflection.kind]}`.replace(/([a-z])([A-Z])/gu, "$1-$2").toLowerCase()
    : "declaration"

const membersOf = (reflection: DeclarationReflection): ReadonlyArray<DeclarationReflection> => {
  const candidates = (reflection.children?.length ?? 0) > 0 ?
    reflection.children ?? []
    : reflection.type?.type === "reflection" ?
    reflection.type.declaration.children ?? []
    : []
  return Arr.filter(candidates, (member) =>
    !member.flags.isPrivate && !member.flags.isProtected && (
      Option.isSome(firstSourceUrl(member)) || (!member.flags.isInherited && !member.flags.isExternal)
    ))
}

const memberModel = (
  member: DeclarationReflection,
  exportName: string,
  context: ApiDocContext,
  fallbackSourceUrl: string
): ApiMember => {
  const sourceUrl = firstSourceUrl(member)
  const signatures = signatureModels(member, member.name, context, Option.getOrElse(sourceUrl, () => fallbackSourceUrl))
  const type = Option.fromNullable(member.type).pipe(Option.map((value) => value.toString()))
  const declaration = signatures.length > 0 ?
    Arr.map(signatures, (signature) => signature.code).join("\n")
    : `${member.flags.isStatic ? "static " : ""}${member.flags.isReadonly ? "readonly " : ""}${member.name}${
      member.flags.isOptional ? "?" : ""
    }${Option.match(type, { onNone: () => "", onSome: (value) => `: ${value}` })}${
      Option.match(Option.fromNullable(member.defaultValue), { onNone: () => "", onSome: (value) => ` = ${value}` })
    }`

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
    docs: documentation(Option.fromNullable(member.comment), context),
    signatures,
    sourceUrl: Option.getOrElse(sourceUrl, () => fallbackSourceUrl)
  }
}

const declarationCode = (
  reflection: DeclarationReflection,
  signatures: ReadonlyArray<ApiSignature>
): string => {
  const generics = (reflection.typeParameters?.length ?? 0) === 0 ?
    ""
    : `<${Arr.map(reflection.typeParameters ?? [], typeParameterCode).join(", ")}>`
  const extended = reflection.extendedTypes?.length
    ? ` extends ${Arr.map(reflection.extendedTypes, (type) => type.toString()).join(", ")}` :
    ""
  const implemented = reflection.implementedTypes?.length
    ? ` implements ${Arr.map(reflection.implementedTypes, (type) => type.toString()).join(", ")}` :
    ""
  if (reflection.kindOf(ReflectionKind.Function) || signatures.length > 0) {
    return Arr.map(signatures, (signature) => signature.code).join("\n")
  }
  if (reflection.kindOf(ReflectionKind.Class)) return `class ${reflection.name}${generics}${extended}${implemented}`
  if (reflection.kindOf(ReflectionKind.Interface)) return `interface ${reflection.name}${generics}${extended}`
  if (reflection.kindOf(ReflectionKind.TypeAlias)) {
    return `type ${reflection.name}${generics} = ${reflection.type?.toString() ?? "unknown"}`
  }
  if (reflection.kindOf(ReflectionKind.Variable)) {
    return `${reflection.flags.isConst ? "const" : "let"} ${reflection.name}: ${
      reflection.type?.toString() ?? "unknown"
    }`
  }
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
    type: Option.fromNullable(reflection.type).pipe(Option.map((value) => value.toString())),
    typeParameters: typeParameters(reflection.typeParameters ?? [], Option.fromNullable(reflection.comment), context),
    extends: Arr.map(reflection.extendedTypes ?? [], (type) => type.toString()),
    implements: Arr.map(reflection.implementedTypes ?? [], (type) => type.toString()),
    docs: documentation(Option.fromNullable(reflection.comment), context),
    signatures,
    members: Arr.map(membersOf(reflection), (member) => memberModel(member, reflection.name, context, sourceUrl)),
    sourceUrl
  }
}

const summaryText = (parts: ReadonlyArray<ApiDocPart>): string => Arr.map(parts, (part) => part.text).join("").trim()

const exportSummary = (
  facets: ReadonlyArray<ApiFacet>,
  fallback: string,
  moduleSummary: string
): string => {
  const facetSummaries = Arr.map(facets, (facet) => summaryText(facet.docs.summary))
  const signatureSummaries = Arr.flatMap(
    facets,
    (facet) => Arr.map(facet.signatures, (signature) => summaryText(signature.docs.summary))
  )

  return Option.getOrElse(
    Arr.findFirst(
      [
        ...Arr.filter(facetSummaries, (summary) => summary !== moduleSummary),
        ...signatureSummaries,
        fallback,
        ...facetSummaries
      ],
      (candidate) => candidate.length > 0
    ),
    () => fallback
  )
}

const exportModel = (
  packageName: string,
  packageSlug: string,
  moduleReflection: DeclarationReflection,
  route: ApiReferenceRoute,
  context: ApiDocContext,
  moduleSummary: string,
  entry: ApiReferenceImport
) =>
  Effect.map(
    Effect.forEach(entry.reflections, (facet) =>
      Option.match(
        Arr.findFirst(moduleReflection.children ?? [], (reflection) => reflection.id === facet.reflectionId),
        {
          onNone: () =>
            Effect.fail(
              new ApiReferenceGenerationError({
                packageName,
                detail: `${route.subpath} export ${entry.name} reflection ${String(facet.reflectionId)} is missing`
              })
            ),
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
      summary: exportSummary(facets, entry.summary, moduleSummary),
      facets
    })
  )

export const apiExports = (
  packageName: string,
  packageSlug: string,
  moduleReflection: DeclarationReflection,
  route: ApiReferenceRoute,
  context: ApiDocContext
) => {
  const moduleSummary = summaryText(documentation(Option.fromNullable(moduleReflection.comment), context).summary)

  return Effect.forEach(route.imports, (entry) =>
    exportModel(
      packageName,
      packageSlug,
      moduleReflection,
      route,
      context,
      moduleSummary,
      entry
    ))
}
