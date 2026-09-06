import { Context, Effect, Layer, Option, Schema, Stream } from "effect"

/**
 * The document this page renders into, as a service. The head, the root
 * element and document-level events are reached through this tag so that
 * metadata updates, focus management and keyboard shortcuts stay testable
 * and never reach for the global.
 *
 * @since 0.2.0
 */
export class BrowserDocument extends Context.Tag("theoria/BrowserDocument")<BrowserDocument, Document>() {}

/** The ambient document. This is the one place the app reads the global. */
export const layer: Layer.Layer<BrowserDocument> = Layer.sync(BrowserDocument, () => document)

export const elementById = (id: string): Effect.Effect<Option.Option<HTMLElement>, never, BrowserDocument> =>
  Effect.map(BrowserDocument, (browserDocument) => Option.fromNullable(browserDocument.getElementById(id)))

export const querySelector = (selector: string): Effect.Effect<Option.Option<HTMLElement>, never, BrowserDocument> =>
  Effect.map(
    BrowserDocument,
    (browserDocument) => Option.fromNullable(browserDocument.querySelector<HTMLElement>(selector))
  )

/** An element in the shell's `<head>`; a missing one is the server's to create, so callers usually do nothing. */
export const headElement = (selector: string): Effect.Effect<Option.Option<HTMLElement>, never, BrowserDocument> =>
  Effect.map(
    BrowserDocument,
    (browserDocument) => Option.fromNullable(browserDocument.head.querySelector<HTMLElement>(selector))
  )

export const setTitle = (text: string): Effect.Effect<void, never, BrowserDocument> =>
  Effect.flatMap(BrowserDocument, (browserDocument) =>
    Effect.sync(() => {
      browserDocument.title = text
    }))

/** Adds or removes a class on `<html>`; the theme lives here so CSS variables switch for the whole page. */
export const toggleRootClass = (name: string, present: boolean): Effect.Effect<void, never, BrowserDocument> =>
  Effect.flatMap(BrowserDocument, (browserDocument) =>
    Effect.sync(() => {
      browserDocument.documentElement.classList.toggle(name, present)
    }))

/** Document events of one type as a stream; the listener is removed when the stream ends. */
export const events = <K extends keyof DocumentEventMap>(
  type: K,
  options?: boolean | AddEventListenerOptions
): Stream.Stream<DocumentEventMap[K], never, BrowserDocument> =>
  Stream.unwrap(
    Effect.map(BrowserDocument, (browserDocument) =>
      Stream.fromEventListener<DocumentEventMap[K]>(browserDocument, type, options))
  )

/**
 * The document could not supply a 2D canvas: the host has no canvas support,
 * refused the context, or is headless. Text measured against this document's
 * fonts is impossible, and callers say so rather than estimate.
 *
 * @since 0.2.0
 */
export class CanvasUnavailable extends Schema.TaggedError<CanvasUnavailable>()("CanvasUnavailable", {
  message: Schema.String
}) {}

/** A 2D canvas for text measurement in this document's fonts. */
export const canvasContext2d: Effect.Effect<CanvasRenderingContext2D, CanvasUnavailable, BrowserDocument> = Effect
  .flatMap(
    BrowserDocument,
    (browserDocument) =>
      Option.fromNullable(browserDocument.createElement("canvas").getContext("2d")).pipe(
        Option.match({
          onNone: () => new CanvasUnavailable({ message: "The document returned no 2D canvas context." }),
          onSome: Effect.succeed
        })
      )
  )
