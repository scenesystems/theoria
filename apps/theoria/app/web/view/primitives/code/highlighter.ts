import type { HighlighterCore, ThemeRegistration } from "@shikijs/core"
import type { ThemedToken } from "@shikijs/types"
import { Effect, Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"

export const HighlightTokenKind = Schema.Literal(
  "plain",
  "comment",
  "keyword",
  "string",
  "number",
  "type",
  "function",
  "operator"
)

export type HighlightTokenKind = typeof HighlightTokenKind.Type

export const HighlightToken = Schema.Struct({
  kind: HighlightTokenKind,
  value: Schema.String
})

export type HighlightToken = typeof HighlightToken.Type

export const CodeLanguage = Schema.Literal("shellscript", "text", "typescript")
export type CodeLanguage = typeof CodeLanguage.Type

export class SyntaxHighlightingError extends Schema.TaggedError<SyntaxHighlightingError>()(
  "SyntaxHighlightingError",
  { detail: Schema.String }
) {}

const theoriaTheme = (): ThemeRegistration => ({
  name: "theoria",
  type: "light",
  fg: "var(--th-ink-900)",
  bg: "transparent",
  settings: [
    {
      settings: {
        foreground: "var(--th-ink-900)",
        background: "transparent"
      }
    },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "var(--th-code-comment)", fontStyle: "italic" }
    },
    {
      scope: ["keyword", "storage", "storage.type", "storage.modifier"],
      settings: { foreground: "var(--th-code-keyword)" }
    },
    {
      scope: ["string", "constant.other.symbol", "constant.other.key"],
      settings: { foreground: "var(--th-code-string)" }
    },
    {
      scope: ["constant.numeric", "constant.language"],
      settings: { foreground: "var(--th-code-number)" }
    },
    {
      scope: ["entity.name.type", "entity.name.class", "support.type", "support.class"],
      settings: { foreground: "var(--th-code-type)" }
    },
    {
      scope: ["entity.name.function", "support.function", "variable.function"],
      settings: { foreground: "var(--th-code-function)" }
    },
    {
      scope: ["keyword.operator", "punctuation.accessor", "punctuation.separator", "meta.brace"],
      settings: { foreground: "var(--th-code-operator)" }
    }
  ]
})

const highlighterLoadError = () =>
  new SyntaxHighlightingError({ detail: "Could not initialize the TypeScript grammar" })

const loadHighlighterModule = <A>(load: () => Promise<A>): Effect.Effect<A, SyntaxHighlightingError> =>
  Effect.tryPromise({ try: load, catch: highlighterLoadError })

const createHighlighter = Effect.all({
  core: loadHighlighterModule(() => import("@shikijs/core")),
  engine: loadHighlighterModule(() => import("@shikijs/engine-oniguruma")),
  wasm: loadHighlighterModule(() => import("@shikijs/engine-oniguruma/wasm-inlined")),
  shellLanguage: loadHighlighterModule(() => import("@shikijs/langs/shellscript")),
  typeScriptLanguage: loadHighlighterModule(() => import("@shikijs/langs/typescript"))
}).pipe(Effect.flatMap(({ core, engine, shellLanguage, typeScriptLanguage, wasm }) =>
  Effect.tryPromise({
    try: () =>
      core.createHighlighterCore({
        engine: engine.createOnigurumaEngine(wasm.default),
        langs: [typeScriptLanguage.default, shellLanguage.default],
        themes: [theoriaTheme()],
        warnings: false
      }),
    catch: () => new SyntaxHighlightingError({ detail: "Could not initialize the TypeScript grammar" })
  })
))

export const makeSyntaxHighlighter = Effect.acquireRelease(
  createHighlighter,
  (highlighter) =>
    Effect.sync(() => {
      highlighter.dispose()
    })
)

const tokenKindFor = (color: Option.Option<string>): HighlightTokenKind =>
  Option.match(color, {
    onNone: (): HighlightTokenKind => "plain",
    onSome: (value) =>
      Match.value(value).pipe(
        Match.when("var(--th-code-comment)", (): HighlightTokenKind => "comment"),
        Match.when("var(--th-code-keyword)", (): HighlightTokenKind => "keyword"),
        Match.when("var(--th-code-string)", (): HighlightTokenKind => "string"),
        Match.when("var(--th-code-number)", (): HighlightTokenKind => "number"),
        Match.when("var(--th-code-type)", (): HighlightTokenKind => "type"),
        Match.when("var(--th-code-function)", (): HighlightTokenKind => "function"),
        Match.when("var(--th-code-operator)", (): HighlightTokenKind => "operator"),
        Match.orElse((): HighlightTokenKind => "plain")
      )
  })

const plainToken = (value: string): HighlightToken => ({ kind: "plain", value })

const projectLine = (line: ReadonlyArray<ThemedToken>): ReadonlyArray<HighlightToken> =>
  line.length === 0
    ? [plainToken("")]
    : Arr.map(line, (token) => ({
      kind: tokenKindFor(Option.fromNullable(token.color)),
      value: token.content
    }))

export const highlightCode = (
  highlighter: HighlighterCore,
  source: string,
  language: Exclude<CodeLanguage, "text">
): ReadonlyArray<ReadonlyArray<HighlightToken>> =>
  Arr.map(
    highlighter.codeToTokens(source, { lang: language, theme: "theoria" }).tokens,
    projectLine
  )

export const plainCode = (source: string): ReadonlyArray<ReadonlyArray<HighlightToken>> =>
  Arr.map(source.split("\n"), (line) => [plainToken(line)])

export const tokenClassName = (kind: HighlightTokenKind): string =>
  Match.value(kind).pipe(
    Match.when("comment", () => "text-code-comment italic"),
    Match.when("keyword", () => "text-code-keyword"),
    Match.when("string", () => "text-code-string"),
    Match.when("number", () => "text-code-number"),
    Match.when("type", () => "text-code-type"),
    Match.when("function", () => "text-code-function"),
    Match.when("operator", () => "text-code-operator"),
    Match.orElse(() => "text-ink-900")
  )
