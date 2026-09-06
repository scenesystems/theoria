import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import type { Layer } from "effect"

import type { CanvasUnavailable } from "../platform/BrowserDocument.js"
import { type BrowserTextLayout, browserTextLayoutLive } from "../text/browserTextLayout.js"

/**
 * The layer every text measurement in the page runs against. The app leaves
 * it at the canvas-backed layer; a registry for a headless document sets it to
 * `deterministicTextLayoutLive` through `initialValues`.
 */
export const textLayoutLayerAtom: AtomType.Writable<Layer.Layer<BrowserTextLayout, CanvasUnavailable>> = Atom.make(
  browserTextLayoutLive
)

/** One runtime, so the measurement cache is shared by text projections and the place drawing alike. */
export const textLayoutRuntime: AtomType.AtomRuntime<BrowserTextLayout, CanvasUnavailable> = Atom.runtime(
  (get: AtomType.Context) => get(textLayoutLayerAtom)
)
