import { Boolean, Data, Either } from "effect"
import { renderToString } from "katex"

import type { MathExpression } from "@theoria/docs-model"
import { SemanticContent } from "./SemanticContent.js"

class InvalidLatex extends Data.TaggedError("InvalidLatex")<{
  readonly source: string
  readonly cause: unknown
}> {}

/**
 * Typesets LaTeX as native, accessible MathML without inline CSS or DOM effects.
 * Only KaTeX output enters the markup sink; document HTML never does. Untrusted
 * TeX commands remain disabled, and each expression has its own macro scope.
 * Invalid input stays visible as escaped source instead of failing the page.
 */
export const MathContent = ({ display, text }: MathExpression) =>
  Either.try({
    try: () =>
      renderToString(text, {
        displayMode: display,
        output: "mathml",
        trust: false,
        strict: "error",
        throwOnError: true,
        maxSize: 20,
        maxExpand: 1000
      }),
    catch: (cause) => new InvalidLatex({ source: text, cause })
  }).pipe(Either.match({
    onLeft: (error) => (
      <SemanticContent as="span" role="body">
        {"Invalid LaTeX: "}
        <SemanticContent as="code" role="code-meta">{error.source}</SemanticContent>
      </SemanticContent>
    ),
    onRight: (mathml) => (
      <span
        className={Boolean.match(display, {
          onTrue: () => "math-content block overflow-x-auto py-2",
          onFalse: () => "math-content"
        })}
        dangerouslySetInnerHTML={{ __html: mathml }}
      />
    )
  }))
