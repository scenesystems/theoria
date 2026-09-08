import { Context, Effect, Layer, Option, Predicate, Schema } from "effect"

import * as BrowserDocument from "./BrowserDocument.js"

/**
 * A face the document was asked to load did not arrive: the request failed,
 * the file was refused, or no `@font-face` declares that family. The page
 * goes on in the stand-in that already matches its metrics.
 *
 * @since 0.2.0
 */
export class FontLoadFailed extends Schema.TaggedError<FontLoadFailed>()("FontLoadFailed", {
  font: Schema.String,
  message: Schema.String
}) {}

/**
 * The document's font faces, as a service: the one place the app waits on a
 * face so that measurement and drawing happen in the type the reader sees.
 *
 * @since 0.2.0
 */
export class BrowserFonts extends Context.Tag("theoria/BrowserFonts")<BrowserFonts, {
  /** Resolves once every face the CSS font shorthand names is loaded, or fails with the reason. */
  readonly load: (font: string) => Effect.Effect<void, FontLoadFailed>
}>() {}

const failure = (font: string) => (cause: unknown): FontLoadFailed =>
  new FontLoadFailed({ font, message: Predicate.isError(cause) ? cause.message : String(cause) })

/**
 * The ambient document's font set. A document without one (a headless test
 * document) has nothing to wait for, so every load is at once complete.
 */
export const layer: Layer.Layer<BrowserFonts, never, BrowserDocument.BrowserDocument> = Layer.effect(
  BrowserFonts,
  Effect.map(
    BrowserDocument.BrowserDocument,
    (browserDocument) =>
      Option.match(Option.fromNullable(browserDocument.fonts), {
        onNone: () => ({ load: () => Effect.void }),
        onSome: (fonts) => ({
          load: (font) => Effect.tryPromise({ try: () => fonts.load(font), catch: failure(font) }).pipe(Effect.asVoid)
        })
      })
  )
)
