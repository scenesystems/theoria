import { customTextAtom, reflowControlsAtom } from "../../atoms/reflow.js"
import { animatingAtom } from "../../atoms/run/animation.js"
import { LiveReflow } from "../../view/deep/LiveReflow.js"
import { ProjectionPlaneHint, SurfaceViewExtension, telemetryRow, telemetrySection } from "../kernel/descriptor.js"

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

    return [telemetrySection(
      "Canonical reflow frames, frozen controls, and custom text state projected from the shared stream.",
      [
        telemetryRow("Frame reactor", get(animatingAtom) ? "projecting" : "idle"),
        telemetryRow(
          "Reflow controls",
          `corpus ${controls.corpusIndex} · width ${controls.width}px · obstacles ${
            controls.obstaclesEnabled ? "on" : "off"
          }`
        ),
        telemetryRow("Custom text", customText.length === 0 ? "empty" : `${customText.length} chars`)
      ],
      "Canonical frame reactor"
    )]
  }
})
