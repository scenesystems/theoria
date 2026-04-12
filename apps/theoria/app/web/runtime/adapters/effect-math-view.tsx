import {
  runRuntimeTelemetryRow,
  runRuntimeTelemetrySection
} from "../../../contracts/presentation/run-runtime-telemetry.js"
import { powerAnimatingAtom, powerProjectionAtom } from "../../atoms/run/power-animation.js"
import { LivePowerExplorer } from "../../view/deep/LivePowerExplorer.js"
import { SurfaceViewExtension } from "../kernel/surface-view-extension.js"

export const effectMathSurfaceViewExtension = SurfaceViewExtension.make({
  interactiveWidget: <LivePowerExplorer />,
  diagnosticsSections: (get) => {
    const projection = get(powerProjectionAtom)

    return [runRuntimeTelemetrySection({
      description: "Canonical power frames and the frozen statistical controls projected from the shared stream.",
      rows: [
        runRuntimeTelemetryRow("Frame reactor", get(powerAnimatingAtom) ? "projecting" : "idle"),
        runRuntimeTelemetryRow(
          "Power controls",
          `d ${projection.d.toFixed(2)} · n ${projection.n} · alpha ${projection.alpha.toFixed(2)}`
        ),
        runRuntimeTelemetryRow(
          "Power report",
          `${(projection.powerReport.power * 100).toFixed(1)}% · critical t ${
            projection.powerReport.criticalValue.toFixed(2)
          }`
        ),
        runRuntimeTelemetryRow(
          "Sample-size inversion",
          `${projection.sampleSizeReport.solver.method} · ${projection.sampleSizeReport.solver.status} · N ${projection.sampleSizeReport.sampleSize}`
        )
      ],
      title: "Power runtime"
    })]
  }
})
