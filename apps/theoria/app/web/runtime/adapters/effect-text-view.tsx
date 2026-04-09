import {
  runRuntimeTelemetryRow,
  runRuntimeTelemetrySection
} from "../../../contracts/presentation/run-runtime-telemetry.js"
import { ProjectionPlaneHint } from "../../../contracts/presentation/surface-runtime-hints.js"
import { customTextAtom, reflowControlsAtom } from "../../atoms/reflow.js"
import { animatingAtom } from "../../atoms/run/animation.js"
import { LiveReflow } from "../../view/deep/LiveReflow.js"
import { SurfaceViewExtension } from "../kernel/descriptor.js"

const effectTextProjectionPlaneHint = ProjectionPlaneHint.make({
  stage:
    "Generic text and deep-dive reflow both reuse prepared handles — drag width, toggle obstacle bands, or press Run to stream authored width checkpoints across the same prepare-once model.",
  evidence:
    "The evidence ledger tracks prepared-handle reuse, obstacle-aware projection, and optional calibration work without inventing a second browser-owned authority.",
  source:
    "Inspect the browser layer, React helper boundary, server run path, and the text consumers that share the same prepare-and-project model."
})

export const effectTextSurfaceViewExtension = SurfaceViewExtension.make({
  interactiveWidget: <LiveReflow />,
  projectionPlaneHint: effectTextProjectionPlaneHint,
  diagnosticsSections: (get) => {
    const controls = get(reflowControlsAtom)
    const customText = get(customTextAtom).trim()

    return [runRuntimeTelemetrySection({
      description: "Canonical reflow frames, frozen controls, and custom text state projected from the shared stream.",
      rows: [
        runRuntimeTelemetryRow("Frame reactor", get(animatingAtom) ? "projecting" : "idle"),
        runRuntimeTelemetryRow(
          "Reflow controls",
          `corpus ${controls.corpusIndex} · width ${controls.width}px · obstacles ${
            controls.obstaclesEnabled ? "on" : "off"
          }`
        ),
        runRuntimeTelemetryRow("Custom text", customText.length === 0 ? "empty" : `${customText.length} chars`)
      ],
      title: "Canonical frame reactor"
    })]
  }
})
