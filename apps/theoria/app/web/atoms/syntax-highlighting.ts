import type { HighlighterCore } from "@shikijs/core"
import { Match, Schema } from "effect"
import { AsyncResult as Result, Atom } from "effect/reactivity"
import type * as AtomType from "effect/reactivity/Atom"

import {
  CodeLanguage,
  highlightCode,
  type HighlightToken,
  makeSyntaxHighlighter,
  plainCode,
  type SyntaxHighlightingError
} from "../view/primitives/code/highlighter.js"

import { appRuntime } from "./runtime.js"

export const syntaxHighlighterAtom: AtomType.Atom<Result.AsyncResult<HighlighterCore, SyntaxHighlightingError>> =
  appRuntime
    .atom(makeSyntaxHighlighter)

/** One piece of source in one language: what a highlighting is of. Structural, so the same code is one key. */
export class CodeSource extends Schema.Class<CodeSource>("@theoria/app/web/atoms/SyntaxHighlighting/CodeSource")({
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
    Atom.make((get: AtomType.AtomContext) =>
      Result.match(get(syntaxHighlighterAtom), {
        onInitial: () => plainCode(code.source),
        onFailure: () => plainCode(code.source),
        onSuccess: ({ value }) =>
          Match.value(code.language).pipe(
            Match.when("text", () => plainCode(code.source)),
            Match.whenOr("shellscript", "typescript", (language) => highlightCode(value, code.source, language)),
            Match.exhaustive
          )
      })
    )
)
