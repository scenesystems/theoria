import { type EntryId } from "../../../contracts/entry/id.js"

import { digestSurfaceRuntime } from "../adapters/digest-runtime.js"
import { effectInferenceSurfaceRuntime } from "../adapters/effect-inference-runtime.js"
import { effectMathSurfaceRuntime } from "../adapters/effect-math-runtime.js"
import { effectSearchSurfaceRuntime } from "../adapters/effect-search-runtime.js"
import { effectTextSurfaceRuntime } from "../adapters/effect-text-runtime.js"
import { sealSurfaceRuntime } from "../adapters/seal-runtime.js"
import { signSurfaceRuntime } from "../adapters/sign-runtime.js"
import { workflowSurfaceRuntime } from "../adapters/workflow-runtime.js"
import { effectDspSurfaceRuntime } from "../capability/effect-dsp.js"
import type { SurfaceRuntime } from "./kind.js"

const surfaceRuntimeById: Readonly<Record<EntryId, SurfaceRuntime>> = {
  "effect-dsp": effectDspSurfaceRuntime,
  "effect-inference": effectInferenceSurfaceRuntime,
  "effect-math": effectMathSurfaceRuntime,
  "effect-search": effectSearchSurfaceRuntime,
  "effect-text": effectTextSurfaceRuntime,
  digest: digestSurfaceRuntime,
  seal: sealSurfaceRuntime,
  sign: signSurfaceRuntime,
  workflow: workflowSurfaceRuntime
}

export const surfaceRuntimeForEntry = (id: EntryId): SurfaceRuntime => surfaceRuntimeById[id]
