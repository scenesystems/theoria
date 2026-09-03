import { Array as Arr, Option } from "effect"
import {
  type Comment,
  type CommentDisplayPart,
  Reflection,
  ReflectionKind,
  ReflectionSymbolId,
  type TypeParameterReflection
} from "typedoc"

import { type ApiDocPart, type ApiDocumentation, type ApiExample, type ApiTypeParameter } from "@theoria/docs-model"
import { type ApiDocLink } from "./links.js"
import { type ApiReferenceRoute } from "./model.js"
import { apiExportAnchor } from "./presentation.js"

export type ApiDocContext = {
  readonly packageName: string
  readonly route: ApiReferenceRoute
  readonly links: ReadonlyArray<ApiDocLink>
}

const publicReflection = (target: Reflection): Reflection => {
  if (target.kindOf(ReflectionKind.Module) || target.parent === undefined) return target
  if (target.parent.kindOf(ReflectionKind.Module)) return target
  return publicReflection(target.parent)
}

const publicHref = (
  context: ApiDocContext,
  packageName: string,
  names: ReadonlyArray<string>
): string | null =>
  Option.getOrNull(
    Arr.findFirst(context.links, ([candidatePackage, candidateName]) =>
      candidatePackage === packageName && Arr.contains(names, candidateName)).pipe(
        Option.map(([, , href]) =>
          href
        )
      )
  )

const textNames = (text: string): ReadonlyArray<string> => {
  const trimmed = text.trim()
  const finalName = /(?:^|[.)])([$\p{ID_Start}_][$\p{ID_Continue}_]*)$/u.exec(trimmed)?.[1]
  return finalName === undefined || finalName === trimmed ? [trimmed] : [trimmed, finalName]
}

const uniqueHref = (context: ApiDocContext, names: ReadonlyArray<string>): string | null => {
  const matches = Arr.dedupe(
    Arr.filterMap(context.links, ([, name, href]) => Arr.contains(names, name) ? Option.some(href) : Option.none())
  )
  return matches.length === 1 ? matches[0] ?? null : null
}

const resolvedHref = (
  context: ApiDocContext,
  packageName: string,
  names: ReadonlyArray<string>
): string | null => publicHref(context, packageName, names) ?? uniqueHref(context, names)

const reflectionHref = (context: ApiDocContext, target: Reflection, text: string): string | null => {
  const publicTarget = publicReflection(target)

  return Option.match(
    Arr.findFirst(
      context.route.imports,
      (entry) => Arr.some(entry.reflections, (facet) => facet.reflectionId === publicTarget.id)
    ),
    {
      onNone: () =>
        publicTarget.kindOf(ReflectionKind.Module) && (
            publicTarget.name.endsWith(context.route.subpath.slice(1))
          )
          ? context.route.path
          : resolvedHref(
            context,
            publicTarget.project.packageName ?? context.packageName,
            Arr.append(textNames(text), publicTarget.name)
          ),
      onSome: (entry) => `${context.route.path}#${apiExportAnchor(entry.name)}`
    }
  )
}

const symbolHref = (context: ApiDocContext, target: ReflectionSymbolId, text: string) => {
  const symbolName = target.qualifiedName.split(".").at(-1)
  return resolvedHref(
    context,
    target.packageName,
    symbolName === undefined || symbolName.length === 0
      ? textNames(text)
      : Arr.append(textNames(text), symbolName)
  )
}

const inlineCodeText = (text: string): string => {
  const match = /^`([^`\n]+)`$/u.exec(text)
  return match?.[1] ?? text
}

export const docParts = (
  parts: ReadonlyArray<CommentDisplayPart> | undefined,
  context: ApiDocContext
): ReadonlyArray<ApiDocPart> =>
  Arr.map(parts ?? [], (part): ApiDocPart => {
    if (part.kind === "text") return { kind: "text", text: part.text }
    if (part.kind === "code") return { kind: "code", text: inlineCodeText(part.text) }
    if (part.kind === "relative-link") return { kind: "text", text: part.text }

    return {
      kind: "link",
      text: part.text,
      href: typeof part.target === "string"
        ? part.target
        : part.target instanceof Reflection
        ? reflectionHref(context, part.target, part.text)
        : part.target instanceof ReflectionSymbolId
        ? symbolHref(context, part.target, part.text)
        : resolvedHref(context, context.packageName, textNames(part.text))
    }
  })

export const tagParts = (comment: Comment | undefined, tag: `@${string}`, context: ApiDocContext) =>
  docParts(comment?.getTag(tag)?.content, context)

const fencedCode = /^```([^\n]*)\n([\s\S]*?)\n?```$/u

const exampleModel = (parts: ReadonlyArray<ApiDocPart>): ApiExample => {
  const onlyPart = parts.length === 1 ? parts[0] : undefined
  const code = onlyPart?.kind === "code" ? fencedCode.exec(onlyPart.text.trim()) : null

  return code?.[2] === undefined
    ? { language: null, code: null, parts }
    : {
      language: code[1]?.trim() || null,
      code: code[2],
      parts: []
    }
}

export const documentation = (
  comment: Comment | undefined,
  context: ApiDocContext
): ApiDocumentation => ({
  summary: docParts(comment?.summary, context),
  remarks: tagParts(comment, "@remarks", context),
  examples: Arr.map(comment?.getTags("@example") ?? [], (tag) => exampleModel(docParts(tag.content, context))),
  deprecated: Option.match(Option.fromNullable(comment?.getTag("@deprecated")), {
    onNone: () => null,
    onSome: (tag) => docParts(tag.content, context)
  }),
  see: Arr.map(comment?.getTags("@see") ?? [], (tag) => docParts(tag.content, context))
})

export const typeParameters = (
  parameters: ReadonlyArray<TypeParameterReflection> | undefined,
  ownerComment: Comment | undefined,
  context: ApiDocContext
): ReadonlyArray<ApiTypeParameter> =>
  Arr.map(parameters ?? [], (parameter) => ({
    name: parameter.name,
    constraint: parameter.type?.toString() ?? null,
    default: parameter.default?.toString() ?? null,
    description: docParts(
      parameter.comment?.summary ?? ownerComment?.getIdentifiedTag(parameter.name, "@typeParam")?.content,
      context
    )
  }))

export const typeParameterCode = (parameter: TypeParameterReflection): string =>
  `${parameter.varianceModifier === undefined ? "" : `${parameter.varianceModifier} `}${parameter.name}${
    parameter.type === undefined ? "" : ` extends ${parameter.type.toString()}`
  }${parameter.default === undefined ? "" : ` = ${parameter.default.toString()}`}`
