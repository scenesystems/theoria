import { useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"
import * as Arr from "effect/Array"
import { Fragment, type ReactNode } from "react"

import type { SurfaceVariant } from "../../../../contracts/presentation.js"
import { CodeSource, highlightedLinesAtom } from "../../../atoms/syntax-highlighting.js"

import { annotationFor, type CodeAnnotation, CodeAnnotationRow, CodeLine, lineMatches } from "./CodeLine.js"
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

const lineRowClassName = "grid grid-cols-[minmax(0,1fr)] items-start sm:grid-cols-[2.45rem_minmax(0,1fr)] sm:gap-3"

/**
 * A line the page is pointing at: washed across its row, a little wider than
 * the text, with the colour easing in and out.
 */
const focusableLineRowClassName =
  `${lineRowClassName} -mx-2 rounded-md px-2 transition-colors duration-200 ease-theme data-[code-line-focused]:bg-stage-100/80 motion-reduce:transition-none`

const defaultAnnotation = (annotation: CodeAnnotation): ReactNode => <CodeAnnotationRow text={annotation.text} />

/**
 * A code sample, line by line. `links` turn named symbols into links to the
 * API reference; `annotations` show, under a line, the value the running
 * program produced there, rendered by `renderAnnotation` when the caller
 * wants the value to be more than text. `focusedMatch` names the line the
 * page is pointing at, by a substring unique to it.
 */
export const HighlightedCode = ({
  annotations = [],
  focusedMatch = Option.none(),
  language = "typescript",
  links = [],
  renderAnnotation = defaultAnnotation,
  source,
  variant
}: {
  readonly annotations?: ReadonlyArray<CodeAnnotation>
  readonly focusedMatch?: Option.Option<string>
  readonly language?: CodeLanguage
  readonly links?: ReadonlyArray<CodeLink>
  readonly renderAnnotation?: (annotation: CodeAnnotation) => ReactNode
  readonly source: string
  readonly variant: SurfaceVariant
}) => {
  const lines = useHighlightedLines(language, source)
  const showLineNumbers = variant === "expanded"

  return (
    <code className="block text-(length:--st-fs-code-block) font-(--st-fw-code-block) tracking-(--st-tr-code-block) font-(family-name:--st-ff-code-block) leading-(--st-lh-code-block) text-ink-900 [tab-size:2]">
      {Arr.map(lines, (line, lineIndex) => (
        <Fragment key={`${lineIndex}:${line.length}`}>
          <span
            className={focusableLineRowClassName}
            data-code-line-focused={lineMatches(line, focusedMatch) ? "" : undefined}
          >
            <span
              className={showLineNumbers
                ? "hidden select-none text-right text-(length:--st-fs-code-meta) font-(--st-fw-code-meta) text-ink-700/65 sm:block"
                : "hidden"}
            >
              {lineIndex + 1}
            </span>
            <span className="whitespace-pre">
              <CodeLine links={links} tokens={line} />
            </span>
          </span>
          {Option.match(annotationFor(line, annotations), {
            onNone: () => null,
            onSome: (annotation) => (
              <span className={lineRowClassName}>
                <span aria-hidden className="hidden sm:block" />
                <span>{renderAnnotation(annotation)}</span>
              </span>
            )
          })}
        </Fragment>
      ))}
    </code>
  )
}
