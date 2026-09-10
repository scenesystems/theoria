import { Text } from "@scenesystems/effect-text"
import * as Browser from "@scenesystems/effect-text/browser"
import * as Contracts from "@scenesystems/effect-text/contracts"
import { Context, Effect, Layer, type Scope } from "effect"
import * as Arr from "effect/Array"
import { identity } from "effect/Function"

import { measuredFont } from "../../contracts/text.js"
import * as BrowserDocument from "../platform/BrowserDocument.js"
import * as BrowserFonts from "../platform/BrowserFonts.js"

export const browserSupportProfile = Browser.DefaultBrowserSupportProfile
export const browserSupportProfileId = browserSupportProfile.id
export const browserEngineProfile = browserSupportProfile.engineProfile

/** The text services every measurement and layout in the app runs against. */
export type BrowserTextLayout = Contracts.WordSegmenter | Contracts.MeasurementCache | Contracts.EngineProfile

/**
 * What the layout is told of the faces it measures in, by whoever builds it:
 * the generation its widths belong to, and what to do when the served faces
 * arrive after the layout was built without them. The page shows a face's
 * metric-matched stand-in until the face is here, and the layout measures
 * whatever the page shows; a width measured in the stand-in is the stand-in's,
 * and must go with the layout that measured it — which the layout cannot do
 * from within. So it tells, and the teller builds it again at the next
 * revision (`fontReadinessRevisionAtom`).
 */
export class FontReadiness extends Context.Tag("theoria/FontReadiness")<FontReadiness, {
  /** The generation of the widths this layout's cache keeps; advanced by each arrival told. */
  readonly revision: Browser.FontReadinessRevisionType
  /** Told once, when a served face arrives after this layout was built without it. */
  readonly facesArrived: Effect.Effect<void>
}>() {}

/**
 * Text layout measured by the deterministic estimator instead of a canvas.
 * For hosts without a document, headless test documents among them; the
 * app's runtime never falls back to it.
 */
export const deterministicTextLayoutLive: Layer.Layer<BrowserTextLayout> = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.HyphenationDictionaryLive(),
  Layer.succeed(Contracts.EngineProfile, browserEngineProfile),
  Text.TextMeasurerLive,
  Text.MeasurementCacheLive.pipe(Layer.provide(Text.TextMeasurerLive))
)

const canvasTextLayoutLayer = (
  context: CanvasRenderingContext2D,
  fontReadinessRevision: Browser.FontReadinessRevisionType
): Layer.Layer<BrowserTextLayout> => {
  const canvasMeasurer = Browser.CanvasTextMeasurerLive({ context })

  return Layer.mergeAll(
    Text.WordSegmenterLive,
    Text.HyphenationDictionaryLive(),
    Layer.succeed(Contracts.EngineProfile, browserEngineProfile),
    canvasMeasurer,
    Browser.BrowserMeasurementCacheLive({ fontReadinessRevision, profileId: browserSupportProfileId }).pipe(
      Layer.provide(canvasMeasurer)
    )
  )
}

/** The faces the layout measures in: the body's and the code's, at the weight and size measurement is done at. */
const servedFaces: ReadonlyArray<string> = [measuredFont("body"), measuredFont("mono")]

/** Whether the face landed: a face that fails to load is noted, and the page keeps the stand-in it shows. */
const faceLanded = (fonts: Context.Tag.Service<BrowserFonts.BrowserFonts>) => (font: string): Effect.Effect<boolean> =>
  fonts.load(font).pipe(
    Effect.as(true),
    Effect.catchTag(
      "FontLoadFailed",
      (failed) =>
        Effect.logWarning("A served face did not load; text is measured in its stand-in").pipe(
          Effect.annotateLogs({ font: failed.font, reason: failed.message }),
          Effect.as(false)
        )
    )
  )

/**
 * Watches the served faces for as long as the layout lives, without holding
 * it. Faces all in hand need no watching. Faces still in flight are asked for
 * — the browser has them on the way already; asking joins the wait — and
 * when the last of them settles, the arrival is told once if any face
 * landed: the page has swapped a stand-in for its face, and every width the
 * layout measured in the stand-in is now the wrong face's. Faces that all
 * failed changed nothing on the page, so nothing is told.
 *
 * @since 0.4.0
 */
export const servedFacesWatched: Effect.Effect<
  void,
  never,
  BrowserFonts.BrowserFonts | FontReadiness | Scope.Scope
> = Effect.gen(function*() {
  const fonts = yield* BrowserFonts.BrowserFonts
  const readiness = yield* FontReadiness
  const inHand = yield* Effect.forEach(servedFaces, fonts.inHand)
  // Interruptible in its own right: a layer built in an uninterruptible region
  // would otherwise hand that region to the watcher, and a layout left behind
  // for a newer one could not let go of it before the faces settled.
  yield* Effect.unless(
    Effect.forkScoped(
      Effect.interruptible(
        Effect.forEach(servedFaces, faceLanded(fonts), { concurrency: "unbounded" }).pipe(
          Effect.flatMap((landed) => Effect.when(readiness.facesArrived, () => Arr.some(landed, identity)))
        )
      )
    ),
    () => Arr.every(inHand, identity)
  )
})

/**
 * Text layout measured on the document's 2D canvas, in the face the document
 * shows — the served face, or until it arrives the stand-in declared at its
 * metrics — at the revision the readiness names, watching for the faces'
 * arrival (`servedFacesWatched`). Never held for a face: the page is not,
 * and what stands on it is measured as it stands. A document that cannot
 * supply a canvas fails the layer with `CanvasUnavailable`; nothing is
 * estimated in its place. Build it once per runtime so the measurement cache
 * is shared across every layout.
 */
export const browserTextLayoutLayer: Layer.Layer<
  BrowserTextLayout,
  BrowserDocument.CanvasUnavailable,
  BrowserDocument.BrowserDocument | BrowserFonts.BrowserFonts | FontReadiness
> = Layer.unwrapScoped(
  Effect.gen(function*() {
    const context = yield* BrowserDocument.canvasContext2d
    const readiness = yield* FontReadiness
    yield* servedFacesWatched
    return canvasTextLayoutLayer(context, readiness.revision)
  })
)

/** The canvas layout layer over the ambient document and its fonts; the faces' readiness is its builder's to supply. */
export const browserTextLayoutLive: Layer.Layer<BrowserTextLayout, BrowserDocument.CanvasUnavailable, FontReadiness> =
  browserTextLayoutLayer.pipe(
    Layer.provide(BrowserFonts.layer),
    Layer.provide(BrowserDocument.layer)
  )
