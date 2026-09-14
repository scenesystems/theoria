import { Atom, Registry } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import * as Browser from "@scenesystems/effect-text/browser"
import { Effect, Layer } from "effect"

import type { CanvasUnavailable } from "../platform/BrowserDocument.js"
import { type BrowserTextLayout, browserTextLayoutLive, FontReadiness } from "../text/browserTextLayout.js"

/**
 * The generation of the served faces' readiness the page measures at:
 * advanced each time a served face arrives after a layout was built without
 * it, so the layout is built again and every width measured in the face's
 * stand-in is left behind with the layout that measured it. Every text
 * projection carries the revision it was prepared at, and the layer that
 * measures text is built at it.
 */
export const fontReadinessRevisionAtom: AtomType.Writable<Browser.FontReadinessRevisionType> = Atom.make(
  Browser.initialFontReadinessRevision()
)

/**
 * The layer every text measurement in the page runs against, before it is
 * told of the faces. The app leaves it at the canvas-backed layer; a registry
 * for a headless document sets it to `deterministicTextLayoutLive` through
 * `initialValues`.
 */
export const textLayoutLayerAtom: AtomType.Writable<Layer.Layer<BrowserTextLayout, CanvasUnavailable, FontReadiness>> =
  Atom.make(browserTextLayoutLive)

/** The readiness a layout at this revision is told: its arrival advances the registry's revision. */
const fontReadinessAt = (
  revision: Browser.FontReadinessRevisionType
): Layer.Layer<FontReadiness, never, Registry.AtomRegistry> =>
  Layer.effect(
    FontReadiness,
    Effect.map(Registry.AtomRegistry, (registry) => ({
      revision,
      facesArrived: Effect.sync(() => {
        registry.set(fontReadinessRevisionAtom, Browser.incrementFontReadinessRevision(revision))
      })
    }))
  )

/**
 * The layout layer told of the faces at the current revision: one value per
 * revision, so every runtime built from it shares one measurement cache, and
 * a new revision is a new layer, built afresh in the face the page shows now.
 *
 * The layout itself is built `fresh`: Effect memoizes a layer by its identity
 * alone, not by the readiness it is told, so without this the layer measured
 * at the first revision would be handed back at the next, stand-in widths and
 * all. The value of this atom — one object per revision — is what the memo
 * shares between the runtimes built from it.
 *
 * The readiness is merged into the layer's output, so what runs in the
 * runtime can read the revision it measures at from the runtime itself,
 * rather than from an atom the runtime also depends on — which would prepare
 * every text twice at each arrival, once for each.
 */
export const textLayoutLive: AtomType.Atom<
  Layer.Layer<BrowserTextLayout | FontReadiness, CanvasUnavailable, Registry.AtomRegistry>
> = Atom.make((get: AtomType.Context) =>
  Layer.provideMerge(Layer.fresh(get(textLayoutLayerAtom)), fontReadinessAt(get(fontReadinessRevisionAtom)))
)

/** One runtime, so the measurement cache is shared by text projections and the place drawing alike. */
export const textLayoutRuntime: AtomType.AtomRuntime<BrowserTextLayout | FontReadiness, CanvasUnavailable> = Atom
  .runtime((get: AtomType.Context) => get(textLayoutLive))
