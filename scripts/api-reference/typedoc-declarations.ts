import {
  Array as Arr,
  Boolean as Bool,
  Effect,
  Match,
  Number as Num,
  Option,
  Predicate,
  Schema,
  String as Str
} from "effect"
import {
  type DeclarationReflection,
  type Reflection,
  ReflectionKind,
  type ReflectionType,
  type SomeType
} from "typedoc"

import { type ApiDocPart, type ApiExport, type ApiFacet, type ApiMember, type ApiSignature } from "@theoria/docs-model"
import { ApiReferenceGenerationError, type ApiReferenceImport, type ApiReferenceRoute } from "./model.js"
import { apiExportAnchor, apiExportId } from "./presentation.js"
import { type ApiDocContext, documentation, typeParameterCode, typeParameters } from "./typedoc-comments.js"
import { firstSourceUrl, signatureModels } from "./typedoc-signatures.js"

const numberText = Schema.encodeSync(Schema.NumberFromString)

const reflectionKind = (reflection: Reflection): string =>
  Option.fromNullable(ReflectionKind[reflection.kind]).pipe(
    Option.filter(Predicate.isString),
    Option.map((kind) => Str.toLowerCase(Str.replace(/([a-z])([A-Z])/gu, "$1-$2")(kind))),
    Option.getOrElse(() => "declaration")
  )

const membersOf = (reflection: DeclarationReflection): ReadonlyArray<DeclarationReflection> => {
  const declarationChildren = Option.fromNullable(reflection.type).pipe(
    Option.filter((type): type is ReflectionType => Str.Equivalence(type.type, "reflection")),
    Option.flatMap((type) => Option.fromNullable(type.declaration.children)),
    Option.getOrElse(Arr.empty)
  )
  const candidates = Option.fromNullable(reflection.children).pipe(
    Option.filter(Arr.isNonEmptyReadonlyArray),
    Option.getOrElse(() => declarationChildren)
  )
  return Arr.filter(candidates, (member) =>
    Bool.every(Arr.make(
      Bool.not(member.flags.isPrivate),
      Bool.not(member.flags.isProtected),
      Bool.or(
        Option.isSome(firstSourceUrl(member)),
        Bool.and(Bool.not(member.flags.isInherited), Bool.not(member.flags.isExternal))
      )
    )))
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
  const declaration = Bool.match(Arr.isNonEmptyReadonlyArray(signatures), {
    onTrue: () => Arr.join(Arr.map(signatures, (signature) => signature.code), "\n"),
    onFalse: () =>
      `${Bool.match(member.flags.isStatic, { onTrue: () => "static ", onFalse: () => "" })}${
        Bool.match(member.flags.isReadonly, { onTrue: () => "readonly ", onFalse: () => "" })
      }${member.name}${Bool.match(member.flags.isOptional, { onTrue: () => "?", onFalse: () => "" })}${
        Option.match(type, { onNone: () => "", onSome: (value) => `: ${value}` })
      }${
        Option.match(Option.fromNullable(member.defaultValue), {
          onNone: () => "",
          onSome: (value) => ` = ${value}`
        })
      }`
  })

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
  const typeParameters = Option.fromNullable(reflection.typeParameters).pipe(Option.getOrElse(Arr.empty))
  const generics = Bool.match(Arr.isEmptyReadonlyArray(typeParameters), {
    onTrue: () => "",
    onFalse: () => `<${Arr.join(Arr.map(typeParameters, typeParameterCode), ", ")}>`
  })
  const typeList = (keyword: string, types: Option.Option<ReadonlyArray<SomeType>>) =>
    types.pipe(
      Option.filter(Arr.isNonEmptyReadonlyArray),
      Option.match({
        onNone: () => "",
        onSome: (values) => `${keyword}${Arr.join(Arr.map(values, (type) => type.toString()), ", ")}`
      })
    )
  const extended = typeList(" extends ", Option.fromNullable(reflection.extendedTypes))
  const implemented = typeList(" implements ", Option.fromNullable(reflection.implementedTypes))
  const reflectedType = Option.fromNullable(reflection.type).pipe(
    Option.map((type) => type.toString()),
    Option.getOrElse(() => "unknown")
  )

  return Match.value(true).pipe(
    Match.when(
      (matched) =>
        Bool.and(
          matched,
          Bool.or(reflection.kindOf(ReflectionKind.Function), Arr.isNonEmptyReadonlyArray(signatures))
        ),
      () => Arr.join(Arr.map(signatures, (signature) => signature.code), "\n")
    ),
    Match.when(
      (matched) => Bool.and(matched, reflection.kindOf(ReflectionKind.Class)),
      () => `class ${reflection.name}${generics}${extended}${implemented}`
    ),
    Match.when(
      (matched) => Bool.and(matched, reflection.kindOf(ReflectionKind.Interface)),
      () => `interface ${reflection.name}${generics}${extended}`
    ),
    Match.when(
      (matched) => Bool.and(matched, reflection.kindOf(ReflectionKind.TypeAlias)),
      () => `type ${reflection.name}${generics} = ${reflectedType}`
    ),
    Match.when(
      (matched) => Bool.and(matched, reflection.kindOf(ReflectionKind.Variable)),
      () =>
        `${
          Bool.match(reflection.flags.isConst, { onTrue: () => "const", onFalse: () => "let" })
        } ${reflection.name}: ${reflectedType}`
    ),
    Match.when(
      (matched) => Bool.and(matched, reflection.kindOf(ReflectionKind.Enum)),
      () => `enum ${reflection.name}`
    ),
    Match.when(
      (matched) => Bool.and(matched, reflection.kindOf([ReflectionKind.Namespace, ReflectionKind.Module])),
      () => `namespace ${reflection.name}`
    ),
    Match.orElse(() => `${reflectionKind(reflection)} ${reflection.name}`)
  )
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
    typeParameters: typeParameters(
      Option.fromNullable(reflection.typeParameters).pipe(Option.getOrElse(Arr.empty)),
      Option.fromNullable(reflection.comment),
      context
    ),
    extends: Arr.map(
      Option.fromNullable(reflection.extendedTypes).pipe(Option.getOrElse(Arr.empty)),
      (type) => type.toString()
    ),
    implements: Arr.map(
      Option.fromNullable(reflection.implementedTypes).pipe(Option.getOrElse(Arr.empty)),
      (type) => type.toString()
    ),
    docs: documentation(Option.fromNullable(reflection.comment), context),
    signatures,
    members: Arr.map(membersOf(reflection), (member) => memberModel(member, reflection.name, context, sourceUrl)),
    sourceUrl
  }
}

const summaryText = (parts: ReadonlyArray<ApiDocPart>): string =>
  Str.trim(Arr.join(Arr.map(parts, (part) => part.text), ""))

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
      Arr.appendAll(
        Arr.append(
          Arr.appendAll(
            Arr.filter(facetSummaries, (summary) => Bool.not(Str.Equivalence(summary, moduleSummary))),
            signatureSummaries
          ),
          fallback
        ),
        facetSummaries
      ),
      Str.isNonEmpty
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
        Arr.findFirst(
          Option.fromNullable(moduleReflection.children).pipe(Option.getOrElse(Arr.empty)),
          (reflection) => Num.Equivalence(reflection.id, facet.reflectionId)
        ),
        {
          onNone: () =>
            Effect.fail(
              new ApiReferenceGenerationError({
                packageName,
                detail: `${route.subpath} export ${entry.name} reflection ${numberText(facet.reflectionId)} is missing`
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
