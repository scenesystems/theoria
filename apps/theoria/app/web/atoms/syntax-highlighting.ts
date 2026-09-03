import type { Atom } from "@effect-atom/atom"
import type { Result } from "@effect-atom/atom"
import type { HighlighterCore } from "@shikijs/core"

import { makeSyntaxHighlighter, type SyntaxHighlightingError } from "../view/primitives/code/highlighter.js"

import { appRuntime } from "./runtime.js"

export const syntaxHighlighterAtom: Atom.Atom<Result.Result<HighlighterCore, SyntaxHighlightingError>> = appRuntime
  .atom(makeSyntaxHighlighter)
