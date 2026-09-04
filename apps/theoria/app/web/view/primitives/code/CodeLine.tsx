import { type Option, Schema } from "effect"
import * as Arr from "effect/Array"

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
  "rounded-[3px] underline decoration-dotted decoration-ink-500/70 underline-offset-[3px] transition-colors duration-150 hover:bg-stage-100 hover:decoration-solid hover:decoration-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20"

const Tokens = ({ tokens }: { readonly tokens: ReadonlyArray<HighlightToken> }) => (
  <>
    {Arr.map(
      tokens,
      (token, index) => (
        <span className={tokenClassName(token.kind)} key={`${index}:${token.value.length}`}>
          {token.value.length === 0 ? " " : token.value}
        </span>
      )
    )}
  </>
)

const Segment = ({ segment }: { readonly segment: LineSegment }) =>
  segment._tag === "Tokens"
    ? <Tokens tokens={segment.tokens} />
    : (
      <DocsLink
        className={linkClassName}
        data-code-link={segment.link.text}
        href={segment.link.href}
        title={segment.link.text}
      >
        <Tokens tokens={segment.tokens} />
      </DocsLink>
    )

/**
 * What a line produced in the build on screen. Rendered on its own row under
 * the line, so a long line never pushes the value out of view.
 */
export const CodeAnnotationRow = ({ text }: { readonly text: string }) => (
  <Layer
    render={<span />}
    className="my-1 inline-flex items-center gap-1.5 rounded-md border border-stage-300/85 bg-stage-50/95 px-2 py-0.5 shadow-chip"
    data-code-annotation
  >
    <Layer aria-hidden render={<span />} className="inline-block size-1.5 rounded-full bg-ink-500" />
    <SemanticText as="span" className="text-ink-700" role="code-meta" text={text} />
  </Layer>
)

const lineText = (tokens: ReadonlyArray<HighlightToken>): string =>
  Arr.join(Arr.map(tokens, (token) => token.value), "")

export const annotationFor = (
  tokens: ReadonlyArray<HighlightToken>,
  annotations: ReadonlyArray<CodeAnnotation>
): Option.Option<CodeAnnotation> => {
  const text = lineText(tokens)
  return Arr.findFirst(annotations, (annotation) => text.includes(annotation.match))
}

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
      (segment, index) => <Segment key={`${index}:${segment._tag}`} segment={segment} />
    )}
  </>
)
