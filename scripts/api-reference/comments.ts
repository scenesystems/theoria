import { Array as Arr, Option } from "effect"
import * as ts from "typescript"
import {
  type Application,
  Comment,
  CommentTag,
  type DeclarationReflection,
  MinimalSourceFile,
  normalizePath,
  type ProjectReflection,
  ReflectionKind
} from "typedoc"

type ModuleComment = {
  readonly summary: string
  readonly tags: ReadonlyArray<{
    readonly name: "@category" | "@deprecated" | "@example" | "@remarks" | "@see" | "@since"
    readonly content: string
  }>
}

const renderComment = (comment: ts.JSDoc["comment"]): string => {
  if (comment === undefined) {
    return ""
  }

  return typeof comment === "string"
    ? comment.trim()
    : Arr.fromIterable(comment).map((part) => ts.isJSDocLinkLike(part) ? part.getText() : part.text).join("").trim()
}

const renderTagComment = (tag: ts.JSDocTag): string =>
  tag.getText()
    .slice(`@${tag.tagName.text}`.length)
    .split(/\r?\n/u)
    .map((line) => line.replace(/^\s*\*\s?/u, ""))
    .join("\n")
    .trim()

const supportedTagName = (name: string): Option.Option<ModuleComment["tags"][number]["name"]> =>
  name === "category"
    ? Option.some("@category")
    : name === "deprecated"
    ? Option.some("@deprecated")
    : name === "example"
    ? Option.some("@example")
    : name === "remarks"
    ? Option.some("@remarks")
    : name === "see"
    ? Option.some("@see")
    : name === "since"
    ? Option.some("@since")
    : Option.none()

const firstLeadingJSDoc = (source: string, sourcePath: string): Option.Option<ts.JSDoc> =>
  Arr.head(ts.getLeadingCommentRanges(source, 0) ?? []).pipe(
    Option.filter((range) => range.kind === ts.SyntaxKind.MultiLineCommentTrivia),
    Option.map((range) => source.slice(range.pos, range.end)),
    Option.filter((comment) => comment.startsWith("/**")),
    Option.flatMap((comment) => {
      const sourceFile = ts.createSourceFile(
        sourcePath,
        `${comment}\nexport {}`,
        ts.ScriptTarget.Latest,
        true
      )

      return Arr.head(sourceFile.statements).pipe(
        Option.flatMap((statement) => Arr.findFirst(ts.getJSDocCommentsAndTags(statement), ts.isJSDoc))
      )
    })
  )

const leadingModuleComment = (source: string, sourcePath: string): Option.Option<ModuleComment> => {
  return firstLeadingJSDoc(source, sourcePath).pipe(
    Option.map((jsDoc) => ({
      summary: renderComment(jsDoc.comment),
      tags: Arr.filterMap(jsDoc.tags ?? [], (tag) =>
        Option.map(supportedTagName(tag.tagName.text), (name) => ({
          name,
          content: renderTagComment(tag)
        })))
    })),
    Option.filter((comment) => comment.summary.length > 0 || comment.tags.length > 0)
  )
}

export const moduleReflection = (project: ProjectReflection): Option.Option<DeclarationReflection> =>
  Arr.findFirst(
    project.children ?? [],
    (reflection): reflection is DeclarationReflection => reflection.kindOf(ReflectionKind.Module)
  )

const commentHasSummary = (comment: Comment | undefined): boolean =>
  comment?.summary.some((part) => part.text.trim().length > 0) ?? false

export const hasCommentSummary = (reflection: DeclarationReflection): boolean => {
  if (
    commentHasSummary(reflection.comment)
    || reflection.getAllSignatures().some((signature) => commentHasSummary(signature.comment))
  ) {
    return true
  }

  const target = reflection.isReference() ? reflection.tryGetTargetReflectionDeep() : undefined

  return target !== undefined && target !== reflection && (
    (target.isDeclaration() && hasCommentSummary(target))
    || (target.isSignature() && commentHasSummary(target.comment))
  )
}

export const hasCommentTag = (reflection: DeclarationReflection, tagName: string): boolean =>
  reflection.comment?.blockTags.some(
    (tag) => tag.tag === tagName && tag.content.some((part) => part.text.trim().length > 0)
  ) ?? false

export const attachLeadingModuleComment = (input: {
  readonly app: Application
  readonly project: ProjectReflection
  readonly reflection: DeclarationReflection
  readonly source: string
  readonly sourcePath: string
}): void => {
  const leadingComment = leadingModuleComment(input.source, input.sourcePath)

  if (Option.isNone(leadingComment)) {
    return
  }

  const normalizedSourcePath = normalizePath(input.sourcePath)
  const parseMarkdown = (content: string) => input.app.converter.parseRawComment(
    new MinimalSourceFile(content, normalizedSourcePath),
    input.project.files
  ).content
  const comment = new Comment(
    parseMarkdown(leadingComment.value.summary),
    Arr.map(leadingComment.value.tags, (tag) => new CommentTag(tag.name, parseMarkdown(tag.content)))
  )
  comment.sourcePath = normalizedSourcePath
  input.reflection.comment = comment
  input.app.converter.resolveLinks(comment, input.reflection)
}
