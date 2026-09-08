import { useAtomValue } from "@effect-atom/atom-react"
import { Data, Option } from "effect"
import * as Arr from "effect/Array"
import { Fragment, type ReactNode } from "react"

import { CodeSource, highlightedLinesAtom } from "../../../atoms/syntax-highlighting.js"

import { annotationFor, type CodeAnnotation, CodeAnnotationRow, CodeLine, lineMatches, lineText } from "./CodeLine.js"
import type { CodeLink } from "./codeLinks.js"
import { tokenClassName } from "./highlighter.js"
import type { CodeLanguage, HighlightToken } from "./highlighter.js"

const useHighlightedLines = (language: CodeLanguage, source: string): ReadonlyArray<ReadonlyArray<HighlightToken>> =>
  useAtomValue(highlightedLinesAtom(new CodeSource({ language, source })))

const HighlightTokens = ({
  line,
  lineIndex
}: {
  readonly line: ReadonlyArray<HighlightToken>
  readonly lineIndex: number
}) => (
  <>
    {Arr.map(
      line,
      (token, tokenIndex) => (
        <span className={tokenClassName(token.kind)} key={`${lineIndex}:${tokenIndex}:${token.value.length}`}>
          {token.value.length === 0 ? " " : token.value}
        </span>
      )
    )}
  </>
)

export const InlineHighlightedCode = ({
  className = "",
  language = "typescript",
  source
}: {
  readonly className?: string
  readonly language?: CodeLanguage
  readonly source: string
}) => {
  const lines = useHighlightedLines(language, source)

  return (
    <code
      className={`whitespace-pre-wrap break-words text-(length:--st-fs-code-meta) font-(--st-fw-code-meta) tracking-(--st-tr-code-meta) font-(family-name:--st-ff-code-block) leading-(--st-lh-code-meta) ${className}`}
    >
      {Arr.map(lines, (line, lineIndex) => (
        <span key={`${lineIndex}:${line.length}`}>
          {lineIndex === 0 ? null : "\n"}
          <HighlightTokens line={line} lineIndex={lineIndex} />
        </span>
      ))}
    </code>
  )
}

/**
 * A line's row: the gutter, then the text. The gutter is there at every
 * width — where a line's number is the control for the line, a phone reaches
 * it too — narrower on a phone, where the room is the text's.
 */
const lineRowClassName =
  "grid grid-cols-[2rem_minmax(0,1fr)] gap-2 items-start sm:grid-cols-[2.45rem_minmax(0,1fr)] sm:gap-3"

/**
 * A line the page is pointing at: washed across its row, a little wider than
 * the text, with the colour easing in and out.
 */
const focusableLineRowClassName =
  `${lineRowClassName} -mx-2 rounded-md px-2 transition-colors duration-200 ease-theme data-[code-line-focused]:bg-stage-100/80 forced-colors:data-[code-line-focused]:bg-[Highlight] forced-colors:data-[code-line-focused]:text-[HighlightText] motion-reduce:transition-none`

const defaultAnnotation = (annotation: CodeAnnotation): ReactNode => <CodeAnnotationRow text={annotation.text} />

/** A line of the sample as the gutter has it: its number, from one, and its text. */
export class GutterLine extends Data.Class<{
  readonly number: number
  readonly text: string
}> {}

/** The gutter as a listing has it: the number alone. */
export const gutterNumber = (line: GutterLine): ReactNode => line.number

/**
 * A code sample, line by line, each with its number in the gutter. `links`
 * turn named symbols into links to the API reference; `annotations` show,
 * under a line, the value the running program produced there, rendered by
 * `renderAnnotation` when the caller wants the value to be more than text.
 * `focusedMatch` names the line the page is pointing at, by a substring
 * unique to it. `renderLineNumber` draws the gutter, where a caller can make
 * a line's number the control for the line — the line itself holds links,
 * and a control may not.
 */
export const HighlightedCode = ({
  annotations = [],
  focusedMatch = Option.none(),
  language = "typescript",
  links = [],
  renderAnnotation = defaultAnnotation,
  renderLineNumber = gutterNumber,
  source
}: {
  readonly annotations?: ReadonlyArray<CodeAnnotation>
  readonly focusedMatch?: Option.Option<string>
  readonly language?: CodeLanguage
  readonly links?: ReadonlyArray<CodeLink>
  readonly renderAnnotation?: (annotation: CodeAnnotation) => ReactNode
  readonly renderLineNumber?: (line: GutterLine) => ReactNode
  readonly source: string
}) => {
  const lines = useHighlightedLines(language, source)

  return (
    <code className="block text-(length:--st-fs-code-block) font-(--st-fw-code-block) tracking-(--st-tr-code-block) font-(family-name:--st-ff-code-block) leading-(--st-lh-code-block) text-ink-900 [tab-size:2]">
      {Arr.map(lines, (line, lineIndex) => (
        <Fragment key={`${lineIndex}:${line.length}`}>
          <span
            className={focusableLineRowClassName}
            data-code-line-focused={lineMatches(line, focusedMatch) ? "" : undefined}
          >
            <span className="block select-none text-right text-(length:--st-fs-code-meta) font-(--st-fw-code-meta) text-ink-700/65">
              {renderLineNumber(new GutterLine({ number: lineIndex + 1, text: lineText(line) }))}
            </span>
            <span className="whitespace-pre">
              <CodeLine links={links} tokens={line} />
            </span>
          </span>
          {Option.match(annotationFor(line, annotations), {
            onNone: () => null,
            onSome: (annotation) => (
              <span className={lineRowClassName}>
                <span aria-hidden className="block" />
                <span>{renderAnnotation(annotation)}</span>
              </span>
            )
          })}
        </Fragment>
      ))}
    </code>
  )
}
