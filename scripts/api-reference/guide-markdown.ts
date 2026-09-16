import { Array, Boolean, Data, Match, Option, pipe, Schema, String } from "effect"
import type { BlockContent, DefinitionContent, ListItem, PhrasingContent, RootContent } from "mdast"

import { type GuideBlock, GuideInlineSchema } from "@theoria/docs-model"

const repositoryUrl = "https://github.com/scenesystems/theoria"
const InlineParts = Schema.Array(GuideInlineSchema)
const Link = Schema.Struct({ href: Schema.String, packageSlug: Schema.String, revision: Schema.String })

class Source<A> extends Data.Class<{
  readonly node: A
  readonly packageSlug: string
  readonly revision: string
}> {}

export const guideSlug = (value: string): string =>
  pipe(
    String.trim(value),
    String.toLowerCase,
    String.replace(/[^a-z0-9]+/gu, "-"),
    String.replace(/^-|-$/gu, "")
  )

const crossPackageReadme = /^\.\.\/([^/]+)\/README\.md(?:#.*)?$/u
const packageApiRoot = /^\.\/src\/index\.ts(?:#.*)?$/u
const packageApiModule = /^\.\/src\/(.+)\/index\.ts(?:#.*)?$/u
const packageApiFlatModule = /^\.\/src\/([^/]+)\.ts(?:#.*)?$/u

const captureGroup = (pattern: RegExp, text: string): Option.Option<string> =>
  String.match(pattern)(text).pipe(Option.flatMap((match) => Array.get(match, 1)))

const guideHref = (input: typeof Link.Type): string =>
  Boolean.match(Option.isSome(String.match(/^(?:https?:|mailto:|#|\/)/u)(input.href)), {
    onTrue: () => input.href,
    onFalse: () =>
      Boolean.match(Option.isSome(String.match(packageApiRoot)(input.href)), {
        onTrue: () => Array.join(Array.make("/docs/", input.packageSlug, "/api"), ""),
        onFalse: () =>
          captureGroup(crossPackageReadme, input.href).pipe(
            Option.map((slug) => String.concat("/docs/", slug)),
            Option.orElse(() =>
              captureGroup(packageApiModule, input.href).pipe(
                Option.map((module) => Array.join(Array.make("/docs/", input.packageSlug, "/api/", module), ""))
              )
            ),
            Option.orElse(() =>
              captureGroup(packageApiFlatModule, input.href).pipe(
                Option.map((module) => Array.join(Array.make("/docs/", input.packageSlug, "/api/", module), ""))
              )
            ),
            Option.getOrElse(() =>
              Array.join(
                Array.make(
                  repositoryUrl,
                  "blob",
                  input.revision,
                  "packages",
                  input.packageSlug,
                  String.replace(/^\.\//u, "")(input.href)
                ),
                "/"
              )
            )
          )
      })
  })

const inlinePart = (input: Source<PhrasingContent>): typeof InlineParts.Type =>
  Match.value(input.node).pipe(
    Match.withReturnType<typeof InlineParts.Type>(),
    Match.when({ type: "text" }, (node) => Array.of({ kind: "text", text: node.value })),
    Match.when({ type: "inlineCode" }, (node) => Array.of({ kind: "code", text: node.value })),
    Match.when({ type: "break" }, () => Array.of({ kind: "text", text: "\n" })),
    Match.when({ type: "image" }, (node) =>
      Array.of({
        kind: "link",
        text: Option.fromNullable(node.alt).pipe(
          Option.orElse(() => Option.fromNullable(node.title)),
          Option.getOrElse(() => node.url)
        ),
        href: guideHref({ ...input, href: node.url })
      })),
    Match.when({ type: "link" }, (node) =>
      Array.of({
        kind: "link",
        text: inlineText(inlineParts(node.children, input.packageSlug, input.revision)),
        href: guideHref({ ...input, href: node.url })
      })),
    Match.when({ type: Match.is("emphasis", "strong", "delete") }, (node) =>
      inlineParts(node.children, input.packageSlug, input.revision)),
    Match.when({ type: Match.is("footnoteReference", "html", "imageReference", "linkReference") }, () =>
      Array.empty()),
    Match.exhaustive
  )

export const inlineParts = (
  children: Iterable<PhrasingContent>,
  packageSlug: string,
  revision: string
): typeof InlineParts.Type =>
  Array.flatMap(Array.fromIterable(children), (node) => inlinePart({ node, packageSlug, revision }))

export const inlineText = (parts: typeof InlineParts.Type): string =>
  Array.join(Array.map(parts, (part) => part.text), "")

const itemParts = (item: ListItem, packageSlug: string, revision: string): typeof InlineParts.Type =>
  Array.flatMap(item.children, (child) =>
    Match.value(child).pipe(
      Match.when({ type: "paragraph" }, (node) => inlineParts(node.children, packageSlug, revision)),
      Match.when({ type: "list" }, (node) =>
        Array.flatMap(node.children, (nested) => itemParts(nested, packageSlug, revision))),
      Match.when({
        type: Match.is(
          "blockquote",
          "code",
          "definition",
          "footnoteDefinition",
          "heading",
          "html",
          "table",
          "thematicBreak"
        )
      }, () =>
        Array.empty()),
      Match.exhaustive
    ))

const blockquoteParts = (
  children: Iterable<BlockContent | DefinitionContent>,
  packageSlug: string,
  revision: string
): typeof InlineParts.Type =>
  Array.flatMap(Array.fromIterable(children), (child) =>
    Match.value(child).pipe(
      Match.when({ type: "paragraph" }, (node) => inlineParts(node.children, packageSlug, revision)),
      Match.when(
        {
          type: Match.is(
            "blockquote",
            "code",
            "definition",
            "footnoteDefinition",
            "heading",
            "html",
            "list",
            "table",
            "thematicBreak"
          )
        },
        () => Array.empty()
      ),
      Match.exhaustive
    ))

export const guideBlock = ({ node, packageSlug, revision }: Source<RootContent>): Option.Option<GuideBlock> =>
  Match.value(node).pipe(
    Match.withReturnType<Option.Option<GuideBlock>>(),
    Match.when(
      { type: "paragraph" },
      (node) => Option.some({ kind: "paragraph", parts: inlineParts(node.children, packageSlug, revision) })
    ),
    Match.when(
      { type: "code" },
      (node) =>
        Option.some({
          kind: "code",
          language: Option.getOrElse(Option.fromNullable(node.lang), () => "text"),
          source: node.value
        })
    ),
    Match.when({ type: "heading", depth: 1 }, () => Option.none()),
    Match.when({ type: "heading", depth: Match.is(2, 3, 4, 5, 6) }, (node) => {
      const text = inlineText(inlineParts(node.children, packageSlug, revision))
      return Boolean.match(String.isEmpty(text), {
        onTrue: Option.none,
        onFalse: () => Option.some({ kind: "heading", depth: node.depth, id: guideSlug(text), text })
      })
    }),
    Match.when({ type: "list" }, (node) =>
      Option.some({
        kind: "list",
        ordered: Option.getOrElse(Option.fromNullable(node.ordered), () => false),
        items: Array.map(node.children, (item) => itemParts(item, packageSlug, revision))
      })),
    Match.when(
      { type: "blockquote" },
      (node) => Option.some({ kind: "quote", parts: blockquoteParts(node.children, packageSlug, revision) })
    ),
    Match.when({ type: "table" }, (node) => {
      const cells = Array.map(
        node.children,
        (row) => Array.map(row.children, (cell) => inlineParts(cell.children, packageSlug, revision))
      )
      return Option.some({
        kind: "table",
        headers: Option.getOrElse(Array.head(cells), () => Array.empty()),
        rows: Array.drop(cells, 1)
      })
    }),
    Match.when(
      {
        type: Match.is(
          "break",
          "definition",
          "delete",
          "emphasis",
          "footnoteDefinition",
          "footnoteReference",
          "html",
          "image",
          "imageReference",
          "inlineCode",
          "link",
          "linkReference",
          "listItem",
          "strong",
          "tableCell",
          "tableRow",
          "text",
          "thematicBreak",
          "yaml"
        )
      },
      () => Option.none()
    ),
    Match.exhaustive
  )
