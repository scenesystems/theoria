import { HashSet, Match, Option } from "effect"
import * as Arr from "effect/Array"

export type CodeLanguage = "json" | "plain" | "shell" | "ts"

export type HighlightTokenKind =
  | "comment"
  | "keyword"
  | "number"
  | "operator"
  | "plain"
  | "string"
  | "type"

export type HighlightToken = {
  readonly kind: HighlightTokenKind
  readonly value: string
}

const highlightCache: Record<string, ReadonlyArray<ReadonlyArray<HighlightToken>>> = {}

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

const jsonKeywords = HashSet.fromIterable(["false", "null", "true"])

const tsTokenPattern =
  /\/\/.*$|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b|\s+|[^\s]/gu

const shellTokenPattern =
  /#.*$|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\$\{?[A-Za-z_][\w]*\}?|--?[A-Za-z][\w-]*|\b\d+(?:\.\d+)?\b|[./~A-Za-z_][\w./~-]*|\s+|[^\s]/gu

const jsonTokenPattern =
  /"(?:[^"\\]|\\.)*"(?=\s*:)|"(?:[^"\\]|\\.)*"|\b\d+(?:\.\d+)?\b|\btrue\b|\bfalse\b|\bnull\b|\s+|[[\]{}:,]+|[^\s]/gu

const classified = (kind: HighlightTokenKind, value: string): HighlightToken => ({ kind, value })

const isIdentifier = (value: string): boolean => /^[A-Za-z_$][\w$]*$/u.test(value)

const isNumberLiteral = (value: string): boolean => /^\d+(?:\.\d+)?$/u.test(value)

const isOperatorToken = (value: string): boolean => /^[()[\]{}.,;:+\-*/%=&|!<>?^~]+$/u.test(value)

const isTypeIdentifier = (value: string): boolean => isIdentifier(value) && /^[A-Z]/u.test(value)

const classifyTsToken = (value: string): HighlightToken =>
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

const classifyShellToken = (value: string): HighlightToken =>
  Match.value(value).pipe(
    Match.when((token) => token.startsWith("#"), (token) => classified("comment", token)),
    Match.when(
      (token) => token.startsWith("\"") || token.startsWith("'") || token.startsWith("$"),
      (token) => classified("string", token)
    ),
    Match.when((token) => token.startsWith("-") && token.length > 1, (token) => classified("keyword", token)),
    Match.when(isNumberLiteral, (token) => classified("number", token)),
    Match.when((token) => /^(bun|cat|cd|git|npm|pnpm|rg|sh|tsx|vite|yarn)$/u.test(token), (token) =>
      classified("keyword", token)),
    Match.when(isOperatorToken, (token) =>
      classified("operator", token)),
    Match.orElse((token) => classified("plain", token))
  )

const classifyJsonToken = (value: string): HighlightToken =>
  Match.value(value).pipe(
    Match.when((token) => /^"(?:[^"\\]|\\.)*"$/u.test(token), (token) => classified("string", token)),
    Match.when(isNumberLiteral, (token) => classified("number", token)),
    Match.when((token) => HashSet.has(jsonKeywords, token), (token) => classified("keyword", token)),
    Match.when(isOperatorToken, (token) => classified("operator", token)),
    Match.orElse((token) => classified("plain", token))
  )

const tokenizeLine = ({
  language,
  line
}: {
  readonly language: CodeLanguage
  readonly line: string
}): ReadonlyArray<HighlightToken> => {
  const pattern = language === "json"
    ? jsonTokenPattern
    : language === "shell"
    ? shellTokenPattern
    : language === "ts"
    ? tsTokenPattern
    : null
  const tokens = pattern === null
    ? [line]
    : Arr.map(Arr.fromIterable(line.matchAll(pattern)), (match) => match[0] ?? "")

  return tokens.length === 0
    ? [classified("plain", "")]
    : Arr.map(
      tokens,
      language === "json"
        ? classifyJsonToken
        : language === "shell"
        ? classifyShellToken
        : language === "ts"
        ? classifyTsToken
        : (token) => classified("plain", token)
    )
}

export const normalizeCodeLanguage = (raw?: string | null): CodeLanguage => {
  const language = (raw ?? "").replace(/^language-/u, "").split(/\s+/u)[0]?.toLowerCase() ?? ""

  return language === "ts" || language === "tsx" || language === "js" || language === "javascript" ||
      language === "typescript"
    ? "ts"
    : language === "bash" || language === "sh" || language === "shell" || language === "zsh"
    ? "shell"
    : language === "json" || language === "jsonc"
    ? "json"
    : "plain"
}

export const highlightCode = (input: {
  readonly language: CodeLanguage
  readonly source: string
}): ReadonlyArray<ReadonlyArray<HighlightToken>> => {
  const key = `${input.language}:${input.source}`
  const cached = highlightCache[key]

  return Option.match(Option.fromNullable(cached), {
    onNone: () => {
      const highlighted = Arr.map(input.source.split("\n"), (line) => tokenizeLine({ language: input.language, line }))

      highlightCache[key] = highlighted
      return highlighted
    },
    onSome: (value) => value
  })
}

export const warmHighlightedCode = (input: { readonly language: CodeLanguage; readonly source: string }): void => {
  void highlightCode(input)
}

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
