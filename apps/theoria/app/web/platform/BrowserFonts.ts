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
 * The document's font faces, as a service: the one place the app asks after
 * a face, so that measurement and drawing happen in the type the reader sees.
 *
 * Both questions are asked with a CSS font shorthand and are about the faces
 * the document declares for it — `@font-face` rules whose family it names —
 * for the text `FontFaceSet` assumes when given none, a single space: a face
 * whose `unicode-range` leaves the space out is not asked after. The app's
 * served faces are single Latin subsets, which cover it.
 *
 * @since 0.2.0
 */
export class BrowserFonts extends Context.Tag("theoria/BrowserFonts")<BrowserFonts, {
  /**
   * Whether text in this font renders now without a face still to come: every
   * declared face is loaded, or none is declared and a system face stands.
   */
  readonly inHand: (font: string) => Effect.Effect<boolean>
  /** Resolves once every declared face is loaded, or fails with the reason. */
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
        onNone: () => ({ inHand: () => Effect.succeed(true), load: () => Effect.void }),
        onSome: (fonts) => ({
          inHand: (font) => Effect.sync(() => fonts.check(font)),
          load: (font) => Effect.tryPromise({ try: () => fonts.load(font), catch: failure(font) }).pipe(Effect.asVoid)
        })
      })
  )
)
