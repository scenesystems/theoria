import {
  runRuntimeTelemetryRow,
  runRuntimeTelemetrySection
} from "../../../contracts/presentation/run-runtime-telemetry.js"
import { customTextAtom, reflowControlsAtom } from "../../atoms/reflow.js"
import { animatingAtom } from "../../atoms/run/animation.js"
import { LiveReflow } from "../../view/deep/LiveReflow.js"
import { SurfaceViewExtension } from "../kernel/surface-view-extension.js"

export const effectTextSurfaceViewExtension = SurfaceViewExtension.make({
  interactiveWidget: <LiveReflow />,
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
