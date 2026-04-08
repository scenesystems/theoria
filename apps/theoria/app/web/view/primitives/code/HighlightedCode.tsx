import * as Arr from "effect/Array"

import type { SurfaceVariant } from "../../../../contracts/presentation/program.js"

import { highlightCode, tokenClassName } from "./highlighter.js"

export const HighlightedCode = ({
  source,
  variant
}: {
  readonly source: string
  readonly variant: SurfaceVariant
}) => {
  const lines = highlightCode(source)
  const showLineNumbers = variant === "expanded"

  return (
    <code className="block text-(length:--st-fs-code-block) font-weight-(--st-fw-code-block) tracking-(--st-tr-code-block) font-family-(--st-ff-code-block) leading-(--st-lh-code-block) text-ink-900 [tab-size:2]">
      {Arr.map(lines, (line, lineIndex) => (
        <span
          className="grid grid-cols-[minmax(0,1fr)] items-start sm:grid-cols-[2.45rem_minmax(0,1fr)] sm:gap-3"
          key={`${lineIndex}:${line.length}`}
        >
          <span
            className={showLineNumbers
              ? "hidden select-none text-right text-(length:--st-fs-code-meta) font-weight-(--st-fw-code-meta) text-ink-700/65 sm:block"
              : "hidden"}
          >
            {lineIndex + 1}
          </span>
          <span className="whitespace-pre">
            {Arr.map(
              line,
              (token, tokenIndex) => (
                <span className={tokenClassName(token.kind)} key={`${lineIndex}:${tokenIndex}:${token.value.length}`}>
                  {token.value.length === 0 ? " " : token.value}
                </span>
              )
            )}
          </span>
        </span>
      ))}
    </code>
  )
}
