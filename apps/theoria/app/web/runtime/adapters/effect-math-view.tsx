import {
  runRuntimeTelemetryRow,
  runRuntimeTelemetrySection
} from "../../../contracts/presentation/run-runtime-telemetry.js"
import {
  defaultProjectionPlaneHint,
  ProjectionPlaneHint
} from "../../../contracts/presentation/surface-runtime-hints.js"
import { powerAnimatingAtom, powerProjectionAtom } from "../../atoms/run/power-animation.js"
import { LivePowerExplorer } from "../../view/deep/LivePowerExplorer.js"
import { SurfaceViewExtension } from "../kernel/descriptor.js"

const effectMathProjectionPlaneHint = ProjectionPlaneHint.make({
  stage:
    "Sweep effect sizes and sample sizes by streaming authored power checkpoints from effect-math's statistical kernels into one shared runtime spine.",
  evidence:
    "Live power-analysis reports, confidence intervals, and solver statuses streamed from effect-math Statistics and Optimization surfaces with no app-local inference formulas.",
  source: defaultProjectionPlaneHint.source
})

export const effectMathSurfaceViewExtension = SurfaceViewExtension.make({
  interactiveWidget: <LivePowerExplorer />,
  projectionPlaneHint: effectMathProjectionPlaneHint,
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
