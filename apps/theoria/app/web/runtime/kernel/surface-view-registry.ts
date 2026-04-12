import type { EntryId } from "../../../contracts/entry/id.js"
import { effectDspSurfaceViewExtension } from "../adapters/effect-dsp-view.js"
import { effectMathSurfaceViewExtension } from "../adapters/effect-math-view.js"
import { effectSearchSurfaceViewExtension } from "../adapters/effect-search-view.js"
import { effectTextSurfaceViewExtension } from "../adapters/effect-text-view.js"
import { workflowSurfaceViewExtension } from "../adapters/workflow-view.js"
import { nullSurfaceViewExtension } from "./null-surface-view.js"
import type { SurfaceViewExtension } from "./surface-view-extension.js"

const surfaceViewExtensionById: Readonly<Record<EntryId, SurfaceViewExtension>> = {
  "effect-dsp": effectDspSurfaceViewExtension,
  "effect-inference": nullSurfaceViewExtension,
  "effect-math": effectMathSurfaceViewExtension,
  "effect-search": effectSearchSurfaceViewExtension,
  "effect-text": effectTextSurfaceViewExtension,
  digest: nullSurfaceViewExtension,
  seal: nullSurfaceViewExtension,
  sign: nullSurfaceViewExtension,
  workflow: workflowSurfaceViewExtension
}

export const surfaceViewExtensionFor = (id: EntryId): SurfaceViewExtension => surfaceViewExtensionById[id]
