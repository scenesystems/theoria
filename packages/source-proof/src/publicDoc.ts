import { Array as Arr, Option } from "effect"
import * as ts from "typescript"

const renderJSDocComment = (comment: ts.JSDocTag["comment"]): Option.Option<string> =>
  Option.fromNullable(comment).pipe(
    Option.map((value) =>
      typeof value === "string"
        ? value
        : Arr.fromIterable(value).map((part) => ts.isJSDocLinkLike(part) ? part.getText() : part.text).join("")
    ),
    Option.map((value) => value.trim()),
    Option.filter((value) => value.length > 0)
  )

const parseJSDoc = (comment: string, sourcePath: string): Option.Option<ts.JSDoc> => {
  const sourceFile = ts.createSourceFile(
    sourcePath,
    `${comment}\nexport {}`,
    ts.ScriptTarget.Latest,
    true
  )

  return Arr.head(sourceFile.statements).pipe(
    Option.flatMap((statement) => Arr.findFirst(ts.getJSDocCommentsAndTags(statement), ts.isJSDoc))
  )
}

const leadingJSDoc = (node: ts.Node): Option.Option<ts.JSDoc> => {
  const sourceText = node.getSourceFile().text

  return Arr.findFirst(
    ts.getLeadingCommentRanges(sourceText, node.pos) ?? [],
    (range) => sourceText.slice(range.pos, range.end).startsWith("/**")
  ).pipe(
    Option.map((range) => sourceText.slice(range.pos, range.end)),
    Option.flatMap((comment) => parseJSDoc(comment, node.getSourceFile().fileName))
  )
}

const tagValues = (tags: ReadonlyArray<ts.JSDocTag>, tagName: string): ReadonlyArray<string> =>
  Arr.filterMap(tags, (tag) =>
    tag.tagName.text === tagName
      ? renderJSDocComment(tag.comment)
      : Option.none<string>())

const leadingCommentTagValues = (node: ts.Node, tagName: string): ReadonlyArray<string> =>
  Option.match(leadingJSDoc(node), {
    onNone: () => [],
    onSome: (jsDoc) => tagValues(jsDoc.tags ?? [], tagName)
  })

/**
 * Collects raw JSDoc tag values from a declaration or export statement.
 *
 * @since 0.0.0
 * @category queries
 */
export const docTagValues = (node: ts.Node, tagName: string): ReadonlyArray<string> => {
  const jsDocTagValues = tagValues(ts.getJSDocTags(node), tagName)

  return jsDocTagValues.length > 0 ? jsDocTagValues : leadingCommentTagValues(node, tagName)
}

/**
 * Reads the first matching JSDoc tag value from a declaration or export node.
 *
 * @since 0.0.0
 * @category queries
 */
export const docTagValue = (node: ts.Node, tagName: string): string | null =>
  Option.getOrNull(Option.fromNullable(docTagValues(node, tagName)[0]))

/**
 * Reads the first matching JSDoc tag value from an ordered node sequence.
 *
 * @since 0.0.0
 * @category queries
 */
export const docTagValueFromNodes = (nodes: ReadonlyArray<ts.Node>, tagName: string): string | null =>
  Option.getOrNull(
    Arr.findFirst(nodes, (node) => docTagValues(node, tagName).length > 0).pipe(
      Option.flatMap((node) => Option.fromNullable(docTagValue(node, tagName)))
    )
  )

const renderJSDocSummary = (comment: ts.JSDoc["comment"]): Option.Option<string> =>
  Option.fromNullable(comment).pipe(
    Option.map((value) =>
      typeof value === "string"
        ? value
        : Arr.fromIterable(value).map((part) => ts.isJSDocLinkLike(part) ? part.getText() : part.text).join("")
    ),
    Option.map((value) => value.trim()),
    Option.filter((value) => value.length > 0)
  )

/**
 * Reads the leading JSDoc summary for a declaration or export node.
 *
 * @since 0.0.0
 * @category queries
 */
export const docSummary = (node: ts.Node): string | null =>
  Option.getOrNull(
    Arr.findFirst(ts.getJSDocCommentsAndTags(node), ts.isJSDoc).pipe(
      Option.flatMap((jsDoc) => renderJSDocSummary(jsDoc.comment)),
      Option.orElse(() =>
        leadingJSDoc(node).pipe(
          Option.flatMap((jsDoc) => renderJSDocSummary(jsDoc.comment))
        )
      )
    )
  )

/**
 * Reads the first leading JSDoc summary from an ordered node sequence.
 *
 * @since 0.0.0
 * @category queries
 */
export const docSummaryFromNodes = (nodes: ReadonlyArray<ts.Node>): string | null =>
  Option.getOrNull(
    Arr.findFirst(nodes, (node) => docSummary(node) !== null).pipe(
      Option.flatMap((node) => Option.fromNullable(docSummary(node)))
    )
  )
