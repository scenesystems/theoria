import { Boolean as Bool, Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import { focusClassName, litChipClassName, respondColorsClassName } from "../designSystem.js"
import { DocsLink } from "../DocsLink.js"
import { Layer } from "../Layout.js"
import { SemanticText } from "../SemanticText.js"

import { type CodeLink, type LineSegment, segmentLine } from "./codeLinks.js"
import { type HighlightToken, tokenClassName } from "./highlighter.js"

/**
 * A value from the running program, shown beside the line that produced it.
 * `match` is a substring unique to that line in the sample.
 */
export const CodeAnnotation = Schema.Struct({
  match: Schema.String,
  text: Schema.String
})
export type CodeAnnotation = typeof CodeAnnotation.Type

const linkClassName =
  `rounded-mark underline decoration-dotted decoration-ink-tertiary-glass underline-offset-[3px] ${respondColorsClassName} hover:bg-instrument hover:decoration-solid hover:decoration-ink ${focusClassName}`

/** A token's text as the page shows it: an empty token still takes a space, so the line keeps its shape. */
export const tokenText = (value: string): string =>
  Bool.match(Str.isEmpty(value), { onTrue: () => " ", onFalse: () => value })

/** A token's key among its line: its place, then its length, since two tokens may read alike. */
export const tokenKey = (index: number, value: string): string => `${String(index)}:${String(Str.length(value))}`

const Tokens = ({ tokens }: { readonly tokens: ReadonlyArray<HighlightToken> }) => (
  <>
    {Arr.map(
      tokens,
      (token, index) => (
        <span className={tokenClassName(token.kind)} key={tokenKey(index, token.value)}>
          {tokenText(token.value)}
        </span>
      )
    )}
  </>
)

const Segment = ({ segment }: { readonly segment: LineSegment }) =>
  Match.value(segment).pipe(
    Match.tag("Tokens", ({ tokens }) => <Tokens tokens={tokens} />),
    Match.tag(
      "Link",
      ({ link, tokens }) => (
        <DocsLink className={linkClassName} data-code-link={link.text} href={link.href} title={link.text}>
          <Tokens tokens={tokens} />
        </DocsLink>
      )
    ),
    Match.exhaustive
  )

/**
 * What a line produced in the build on screen. Rendered on its own row under
 * the line, so a long line never pushes the value out of view.
 */
export const CodeAnnotationRow = ({ text }: { readonly text: string }) => (
  <Layer
    render={<span />}
    className={`${litChipClassName} my-1 inline-flex items-center gap-1.5 rounded-mark border border-hairline-strong-veil bg-canvas-veil px-2 py-0.5`}
    data-code-annotation
  >
    <Layer aria-hidden render={<span />} className="inline-block size-1.5 rounded-full bg-ink-tertiary" />
    <SemanticText as="span" className="text-ink-secondary" role="code-meta" text={text} />
  </Layer>
)

/** The line's text, as the source has it. */
export const lineText = (tokens: ReadonlyArray<HighlightToken>): string =>
  Arr.join(Arr.map(tokens, (token) => token.value), "")

export const annotationFor = (
  tokens: ReadonlyArray<HighlightToken>,
  annotations: ReadonlyArray<CodeAnnotation>
): Option.Option<CodeAnnotation> => {
  const text = lineText(tokens)
  return Arr.findFirst(annotations, (annotation) => Str.includes(annotation.match)(text))
}

/** Whether this line is the one a match names. */
export const lineMatches = (tokens: ReadonlyArray<HighlightToken>, match: Option.Option<string>): boolean =>
  Option.exists(match, (needle) => Str.includes(needle)(lineText(tokens)))

/** One line of a sample: its tokens, with named symbols linked to the API reference. */
export const CodeLine = ({
  links,
  tokens
}: {
  readonly links: ReadonlyArray<CodeLink>
  readonly tokens: ReadonlyArray<HighlightToken>
}) => (
  <>
    {Arr.map(
      segmentLine(tokens, links),
      (segment, index) => <Segment key={`${String(index)}:${segment._tag}`} segment={segment} />
    )}
  </>
)
