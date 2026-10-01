import { Array as Arr, Boolean as Bool, Data, Match, Number as Num, Option, Predicate, String as Str } from "effect"
import {
  type Comment,
  Comment as CommentApi,
  type CommentDisplayPart,
  type CommentTag,
  Reflection,
  ReflectionKind,
  ReflectionSymbolId,
  type TypeParameterReflection
} from "typedoc"

import { type ApiDocPart, type ApiDocumentation, type ApiExample, type ApiTypeParameter } from "@theoria/docs-model"
import { type ApiDocLink } from "./links.js"
import { type ApiReferenceRoute } from "./model.js"
import { apiExportAnchor } from "./presentation.js"

export class ApiDocContext extends Data.Class<{
  readonly packageName: string
  readonly route: ApiReferenceRoute
  readonly links: ReadonlyArray<ApiDocLink>
}> {}

// TypeDoc leaves `parent` unset on the project root and marks the module level
// with `ReflectionKind.Module`; the public reflection is the nearest ancestor
// that is a direct child of a module.
const publicReflection = (target: Reflection): Reflection =>
  Bool.match(target.kindOf(ReflectionKind.Module), {
    onTrue: () => target,
    onFalse: () =>
      Option.match(Option.fromNullable(target.parent), {
        onNone: () => target,
        onSome: (parent) =>
          Bool.match(parent.kindOf(ReflectionKind.Module), {
            onTrue: () => target,
            onFalse: () => publicReflection(parent)
          })
      })
  })

const publicHref = (
  context: ApiDocContext,
  packageName: string,
  names: ReadonlyArray<string>
): Option.Option<string> =>
  Arr.findFirst(
    context.links,
    ([candidatePackage, candidateName]) =>
      Bool.and(Str.Equivalence(candidatePackage, packageName), Arr.contains(names, candidateName))
  ).pipe(
    Option.map(([, , href]) => href)
  )

const finalIdentifier = /(?:^|[.)])([$\p{ID_Start}_][$\p{ID_Continue}_]*)$/u

const textNames = (text: string): ReadonlyArray<string> => {
  const trimmed = Str.trim(text)
  return Str.match(finalIdentifier)(trimmed).pipe(
    Option.flatMap((match) => Arr.get(match, 1)),
    Option.filter((finalName) => Bool.not(Str.Equivalence(finalName, trimmed))),
    Option.match({
      onNone: () => Arr.make(trimmed),
      onSome: (finalName) => Arr.make(trimmed, finalName)
    })
  )
}

const uniqueHref = (context: ApiDocContext, names: ReadonlyArray<string>): Option.Option<string> => {
  const matches = Arr.dedupe(
    Arr.filterMap(
      context.links,
      ([, name, href]) =>
        Bool.match(Arr.contains(names, name), { onTrue: () => Option.some(href), onFalse: Option.none })
    )
  )
  return Option.liftPredicate((values: ReadonlyArray<string>) => Num.Equivalence(Arr.length(values), 1))(matches).pipe(
    Option.flatMap(Arr.head)
  )
}

const resolvedHref = (
  context: ApiDocContext,
  packageName: string,
  names: ReadonlyArray<string>
): Option.Option<string> =>
  publicHref(context, packageName, names).pipe(Option.orElse(() => uniqueHref(context, names)))

const reflectionHref = (context: ApiDocContext, target: Reflection, text: string): Option.Option<string> => {
  const publicTarget = publicReflection(target)

  return Option.match(
    Arr.findFirst(
      context.route.imports,
      (entry) => Arr.some(entry.reflections, (facet) => Num.Equivalence(facet.reflectionId, publicTarget.id))
    ),
    {
      onNone: () =>
        Bool.match(
          Bool.and(
            publicTarget.kindOf(ReflectionKind.Module),
            Str.endsWith(Str.slice(1)(context.route.subpath))(publicTarget.name)
          ),
          {
            onTrue: () => Option.some(context.route.path),
            onFalse: () =>
              resolvedHref(
                context,
                Option.fromNullable(publicTarget.project.packageName).pipe(
                  Option.getOrElse(() => context.packageName)
                ),
                Arr.append(textNames(text), publicTarget.name)
              )
          }
        ),
      onSome: (entry) => Option.some(`${context.route.path}#${apiExportAnchor(entry.name)}`)
    }
  )
}

const symbolHref = (context: ApiDocContext, target: ReflectionSymbolId, text: string) =>
  resolvedHref(
    context,
    target.packageName,
    Arr.last(Str.split(target.qualifiedName, ".")).pipe(
      Option.filter(Str.isNonEmpty),
      Option.match({
        onNone: () => textNames(text),
        onSome: (symbolName) => Arr.append(textNames(text), symbolName)
      })
    )
  )

const inlineCode = /^`([^`\n]+)`$/u

const inlineCodeText = (text: string): string =>
  Str.match(inlineCode)(text).pipe(
    Option.flatMap((match) => Arr.get(match, 1)),
    Option.getOrElse(() => text)
  )

export const docParts = (parts: ReadonlyArray<CommentDisplayPart>, context: ApiDocContext): ReadonlyArray<ApiDocPart> =>
  Arr.map(parts, (part): ApiDocPart =>
    Match.value(part).pipe(
      Match.when({ kind: "text" }, ({ text }): ApiDocPart => ({ kind: "text", text })),
      Match.when({ kind: "code" }, ({ text }): ApiDocPart => ({ kind: "code", text: inlineCodeText(text) })),
      Match.when({ kind: "relative-link" }, ({ text }): ApiDocPart => ({ kind: "text", text })),
      Match.orElse((link): ApiDocPart => ({
        kind: "link",
        text: link.text,
        href: Match.value(link.target).pipe(
          Match.when(Predicate.isString, (target): Option.Option<string> => Option.some(target)),
          Match.when((target): target is Reflection => target instanceof Reflection, (target): Option.Option<string> =>
            reflectionHref(context, target, link.text)),
          Match.when(
            (target): target is ReflectionSymbolId =>
              target instanceof ReflectionSymbolId,
            (target): Option.Option<string> => symbolHref(context, target, link.text)
          ),
          Match.orElse((): Option.Option<string> => resolvedHref(context, context.packageName, textNames(link.text)))
        )
      }))
    ))

const commentTag = (comment: Option.Option<Comment>, tag: `@${string}`): Option.Option<CommentTag> =>
  Option.flatMap(comment, (present) => Option.fromNullable(present.getTag(tag)))

const commentTags = (comment: Option.Option<Comment>, tag: `@${string}`): ReadonlyArray<CommentTag> =>
  Option.match(comment, { onNone: Arr.empty, onSome: (present) => present.getTags(tag) })

/** Plain text of a comment's summary, empty when the comment is absent. */
export const summaryText = (comment: Option.Option<Comment>): string =>
  Option.match(comment, {
    onNone: () => "",
    onSome: (present) => Str.trim(CommentApi.combineDisplayParts(present.summary))
  })

/** Plain text of a comment's first `tag`, empty when absent. */
export const tagText = (comment: Option.Option<Comment>, tag: `@${string}`): string =>
  Option.match(commentTag(comment, tag), {
    onNone: () => "",
    onSome: (present) => Str.trim(CommentApi.combineDisplayParts(present.content))
  })

/** Rendered content of a comment's first `tag`, or nothing when absent. */
export const tagParts = (
  comment: Option.Option<Comment>,
  tag: `@${string}`,
  context: ApiDocContext
): ReadonlyArray<ApiDocPart> =>
  Option.match(commentTag(comment, tag), {
    onNone: Arr.empty,
    onSome: (present) => docParts(present.content, context)
  })

const fencedCode = /^```([^\n]*)\n([\s\S]*?)\n?```$/u

// An example that is exactly one fenced code block is rendered as code with
// its language; anything else keeps its parts.
const exampleModel = (parts: ReadonlyArray<ApiDocPart>): ApiExample =>
  Arr.head(parts).pipe(
    Option.filter(() => Num.Equivalence(Arr.length(parts), 1)),
    Option.filter((only) => Str.Equivalence(only.kind, "code")),
    Option.flatMap((only) => Str.match(fencedCode)(Str.trim(only.text))),
    Option.flatMap((match) =>
      Option.map(Arr.get(match, 2), (code) => ({
        code,
        language: Arr.get(match, 1).pipe(Option.map(Str.trim), Option.filter(Str.isNonEmpty))
      }))
    ),
    Option.match({
      onNone: () => ({ language: Option.none(), code: Option.none(), parts }),
      onSome: ({ code, language }) => ({ language, code: Option.some(code), parts: Arr.empty() })
    })
  )

// TypeDoc folds several `@see` tags into one markdown list (" - item\n" per
// tag). The page model keeps one entry per reference, so unfold it again.
const isMarker = (part: CommentDisplayPart, text: string): boolean =>
  Bool.and(Str.Equivalence(part.kind, "text"), Str.Equivalence(part.text, text))

const seeItems = (parts: ReadonlyArray<CommentDisplayPart>): ReadonlyArray<ReadonlyArray<CommentDisplayPart>> =>
  Bool.match(Option.exists(Arr.head(parts), (first) => isMarker(first, " - ")), {
    onTrue: () =>
      Arr.reduce(
        parts,
        Arr.empty<ReadonlyArray<CommentDisplayPart>>(),
        (items, part) =>
          Bool.match(isMarker(part, " - "), {
            onTrue: () => Arr.append(items, Arr.empty()),
            onFalse: () =>
              Bool.match(isMarker(part, "\n"), {
                onTrue: () => items,
                onFalse: () => Arr.modify(items, Num.decrement(Arr.length(items)), (item) => Arr.append(item, part))
              })
          })
      ),
    onFalse: () => Arr.make(parts)
  })

/** Documentation of a reflection whose TypeDoc comment may be absent. */
export const documentation = (comment: Option.Option<Comment>, context: ApiDocContext): ApiDocumentation => ({
  summary: Option.match(comment, { onNone: Arr.empty, onSome: (present) => docParts(present.summary, context) }),
  remarks: tagParts(comment, "@remarks", context),
  examples: Arr.map(commentTags(comment, "@example"), (tag) => exampleModel(docParts(tag.content, context))),
  deprecated: Option.map(commentTag(comment, "@deprecated"), (tag) => docParts(tag.content, context)),
  see: Arr.flatMap(
    commentTags(comment, "@see"),
    (tag) => Arr.map(seeItems(tag.content), (parts) => docParts(parts, context))
  )
})

// A type parameter is documented either on itself or through the owner's
// `@typeParam <name>` tag.
const typeParameterSummary = (
  parameter: TypeParameterReflection,
  ownerComment: Option.Option<Comment>
): Option.Option<ReadonlyArray<CommentDisplayPart>> =>
  Option.fromNullable(parameter.comment).pipe(
    Option.map((present) => present.summary),
    Option.orElse(() =>
      Option.flatMap(
        ownerComment,
        (present) => Option.fromNullable(present.getIdentifiedTag(parameter.name, "@typeParam"))
      ).pipe(Option.map((tag) => tag.content))
    )
  )

export const typeParameters = (
  parameters: ReadonlyArray<TypeParameterReflection>,
  ownerComment: Option.Option<Comment>,
  context: ApiDocContext
): ReadonlyArray<ApiTypeParameter> =>
  Arr.map(parameters, (parameter) => ({
    name: parameter.name,
    constraint: Option.fromNullable(parameter.type).pipe(Option.map((type) => type.toString())),
    default: Option.fromNullable(parameter.default).pipe(
      Option.map((fallback) => fallback.toString())
    ),
    description: Option.match(typeParameterSummary(parameter, ownerComment), {
      onNone: Arr.empty,
      onSome: (summary) => docParts(summary, context)
    })
  }))

const codeSegment = <A>(value: Option.Option<A>, render: (value: A) => string): string =>
  Option.match(value, { onNone: () => "", onSome: render })

export const typeParameterCode = (parameter: TypeParameterReflection): string =>
  `${codeSegment(Option.fromNullable(parameter.varianceModifier), (modifier) => `${modifier} `)}${parameter.name}${
    codeSegment(Option.fromNullable(parameter.type), (type) => ` extends ${type.toString()}`)
  }${codeSegment(Option.fromNullable(parameter.default), (fallback) => ` = ${fallback.toString()}`)}`
