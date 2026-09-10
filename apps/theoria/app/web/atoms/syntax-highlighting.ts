import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import type { HighlighterCore } from "@shikijs/core"
import { Schema } from "effect"

import {
  CodeLanguage,
  highlightCode,
  type HighlightToken,
  makeSyntaxHighlighter,
  plainCode,
  type SyntaxHighlightingError
} from "../view/primitives/code/highlighter.js"

import { appRuntime } from "./runtime.js"

export const syntaxHighlighterAtom: AtomType.Atom<Result.Result<HighlighterCore, SyntaxHighlightingError>> = appRuntime
  .atom(makeSyntaxHighlighter)

/** One piece of source in one language: what a highlighting is of. Structural, so the same code is one key. */
export class CodeSource extends Schema.Class<CodeSource>("CodeSource")({
  language: CodeLanguage,
  source: Schema.String
}) {}

/**
 * The source as tokens, highlighted once per distinct source and kept while
 * anything shows it; plain until the highlighter has loaded. A code block
 * re-rendered for a value beside it does not tokenise its source again.
 */
export const highlightedLinesAtom = Atom.family(
  (code: CodeSource): AtomType.Atom<ReadonlyArray<ReadonlyArray<HighlightToken>>> =>
    Atom.make((get: AtomType.Context) =>
      Result.match(get(syntaxHighlighterAtom), {
        onInitial: () => plainCode(code.source),
        onFailure: () => plainCode(code.source),
        onSuccess: ({ value }) =>
          code.language === "text" ? plainCode(code.source) : highlightCode(value, code.source, code.language)
      })
    )
)
