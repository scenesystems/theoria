import type { HighlighterCore, ThemeRegistration } from "@shikijs/core"
import type { ThemedToken } from "@shikijs/types"
import { Effect, Option, Schema, Tuple } from "effect"
import * as Arr from "effect/Array"
import * as Rec from "effect/Record"

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

/**
 * What a kind of token is painted with. The theme colours the kind's grammar
 * scopes with `variable`, a token coloured `variable` reads back as the kind,
 * and the view classes it `className`: one table, keyed by the kind itself, so
 * a kind added to `HighlightTokenKind` is a paint owed before the app compiles.
 * `plain` claims no scope; it is the theme's foreground and what every colour
 * the theme does not paint reads back as.
 */
export const highlightTokenPaint: Record<HighlightTokenKind, {
  readonly variable: string
  readonly className: string
  readonly scope: ReadonlyArray<string>
  readonly fontStyle: Option.Option<"italic">
}> = {
  plain: { variable: "var(--th-ink-900)", className: "text-ink-900", scope: [], fontStyle: Option.none() },
  comment: {
    variable: "var(--th-code-comment)",
    className: "text-code-comment italic",
    scope: ["comment", "punctuation.definition.comment"],
    fontStyle: Option.some("italic")
  },
  keyword: {
    variable: "var(--th-code-keyword)",
    className: "text-code-keyword",
    scope: ["keyword", "storage", "storage.type", "storage.modifier"],
    fontStyle: Option.none()
  },
  string: {
    variable: "var(--th-code-string)",
    className: "text-code-string",
    scope: ["string", "constant.other.symbol", "constant.other.key"],
    fontStyle: Option.none()
  },
  number: {
    variable: "var(--th-code-number)",
    className: "text-code-number",
    scope: ["constant.numeric", "constant.language"],
    fontStyle: Option.none()
  },
  type: {
    variable: "var(--th-code-type)",
    className: "text-code-type",
    scope: ["entity.name.type", "entity.name.class", "support.type", "support.class"],
    fontStyle: Option.none()
  },
  function: {
    variable: "var(--th-code-function)",
    className: "text-code-function",
    scope: ["entity.name.function", "support.function", "variable.function"],
    fontStyle: Option.none()
  },
  operator: {
    variable: "var(--th-code-operator)",
    className: "text-code-operator",
    scope: ["keyword.operator", "punctuation.accessor", "punctuation.separator", "meta.brace"],
    fontStyle: Option.none()
  }
}

const scopedKinds = Arr.filter(
  HighlightTokenKind.literals,
  (kind) => Arr.isNonEmptyReadonlyArray(highlightTokenPaint[kind].scope)
)

const theoriaTheme = (): ThemeRegistration => ({
  name: "theoria",
  type: "light",
  fg: highlightTokenPaint.plain.variable,
  bg: "transparent",
  settings: [
    {
      settings: {
        foreground: highlightTokenPaint.plain.variable,
        background: "transparent"
      }
    },
    ...Arr.map(scopedKinds, (kind) => ({
      scope: [...highlightTokenPaint[kind].scope],
      settings: {
        foreground: highlightTokenPaint[kind].variable,
        ...Option.match(highlightTokenPaint[kind].fontStyle, {
          onNone: () => ({}),
          onSome: (fontStyle) => ({ fontStyle })
        })
      }
    }))
  ]
})

/** The kind each theme colour paints; the theme is the authority, so the map is read from it. */
const kindByVariable: Readonly<Record<string, HighlightTokenKind>> = Rec.fromEntries(
  Arr.map(HighlightTokenKind.literals, (kind) => Tuple.make(highlightTokenPaint[kind].variable, kind))
)

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

/** The kind a token's colour says it is; a colour the theme does not paint, or none, is plain. */
export const tokenKindFor = (color: Option.Option<string>): HighlightTokenKind =>
  Option.flatMap(color, (value) => Rec.get(kindByVariable, value)).pipe(
    Option.getOrElse((): HighlightTokenKind => "plain")
  )

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

export const tokenClassName = (kind: HighlightTokenKind): string => highlightTokenPaint[kind].className
