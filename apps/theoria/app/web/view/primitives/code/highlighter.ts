import { HashSet, Match } from "effect"
import * as Arr from "effect/Array"

export type HighlightTokenKind =
  | "plain"
  | "comment"
  | "keyword"
  | "string"
  | "number"
  | "type"
  | "operator"

export type HighlightToken = {
  readonly kind: HighlightTokenKind
  readonly value: string
}

const tsKeywords = HashSet.fromIterable([
  "as",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "else",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "import",
  "interface",
  "let",
  "new",
  "null",
  "return",
  "static",
  "switch",
  "throw",
  "true",
  "try",
  "type",
  "typeof",
  "undefined",
  "var",
  "void",
  "while",
  "yield"
])

const tokenPattern =
  /\/\/.*$|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b|\s+|[^\s]/gu

const isIdentifier = (value: string): boolean => /^[A-Za-z_$][\w$]*$/u.test(value)

const isNumberLiteral = (value: string): boolean => /^\d+(?:\.\d+)?$/u.test(value)

const isOperatorToken = (value: string): boolean => /^[()[\]{}.,;:+\-*/%=&|!<>?^~]+$/u.test(value)

const isTypeIdentifier = (value: string): boolean => isIdentifier(value) && /^[A-Z]/u.test(value)

const classified = (kind: HighlightTokenKind, value: string): HighlightToken => ({ kind, value })

const classifyToken = (value: string): HighlightToken =>
  Match.value(value).pipe(
    Match.when((token) => token.startsWith("//"), (token) => classified("comment", token)),
    Match.when(
      (token) => token.startsWith("\"") || token.startsWith("'") || token.startsWith("`"),
      (token) => classified("string", token)
    ),
    Match.when(isNumberLiteral, (token) => classified("number", token)),
    Match.when((token) => HashSet.has(tsKeywords, token), (token) => classified("keyword", token)),
    Match.when(isTypeIdentifier, (token) => classified("type", token)),
    Match.when(isOperatorToken, (token) => classified("operator", token)),
    Match.orElse((token) => classified("plain", token))
  )

const tokenizeLine = (line: string): ReadonlyArray<HighlightToken> => {
  const tokens = Arr.map(Arr.fromIterable(line.matchAll(tokenPattern)), (match) => match[0] ?? "")

  return tokens.length === 0
    ? [classified("plain", "")]
    : Arr.map(tokens, classifyToken)
}

export const highlightCode = (source: string): ReadonlyArray<ReadonlyArray<HighlightToken>> =>
  Arr.map(source.split("\n"), tokenizeLine)

export const tokenClassName = (kind: HighlightTokenKind): string =>
  Match.value(kind).pipe(
    Match.when("comment", () => "text-code-comment italic"),
    Match.when("keyword", () => "text-code-keyword"),
    Match.when("string", () => "text-code-string"),
    Match.when("number", () => "text-code-number"),
    Match.when("type", () => "text-code-type"),
    Match.when("operator", () => "text-code-operator"),
    Match.orElse(() => "text-ink-900")
  )
