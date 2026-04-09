import {
  runRuntimeTelemetryRow,
  runRuntimeTelemetrySection
} from "../../../contracts/presentation/run-runtime-telemetry.js"
import {
  defaultProjectionPlaneHint,
  ProjectionPlaneHint
} from "../../../contracts/presentation/surface-runtime-hints.js"
import { dspWidgetViewModelAtom } from "../../atoms/dsp-widget-model.js"
import { LiveDspEvaluation } from "../../view/deep/LiveDspEvaluation.js"
import { SurfaceViewExtension } from "../kernel/descriptor.js"

const effectDspProjectionPlaneHint = ProjectionPlaneHint.make({
  stage:
    "Inspect typed sentiment evaluations case-by-case on the same authored step stream that freezes the contract, runs the provider-backed program, and reports the comparison.",
  evidence:
    "Provider-backed evaluation traces, correctness deltas, and runtime metadata — every run records the typed program, baseline, and outcome together.",
  source: defaultProjectionPlaneHint.source
})

export const effectDspSurfaceViewExtension = SurfaceViewExtension.make({
  interactiveWidget: <LiveDspEvaluation />,
  projectionPlaneHint: effectDspProjectionPlaneHint,
  diagnosticsSections: (get) => {
    const viewModel = get(dspWidgetViewModelAtom)

    return [runRuntimeTelemetrySection({
      description:
        "Canonical DSP frames, control lock state, and active runtime context projected from the shared stream.",
      rows: [
        runRuntimeTelemetryRow("Frame reactor", viewModel.isAnimating ? "projecting" : "idle"),
        runRuntimeTelemetryRow("DSP controls", viewModel.controlsLocked ? "frozen" : "interactive"),
        runRuntimeTelemetryRow(
          "DSP runtime",
          viewModel.runtimeStatus === null
            ? `${viewModel.scenario.label} · ${viewModel.moduleType} · ${viewModel.optimizationBudget.display}`
            : viewModel.runtimeStatus.title
        )
      ],
      title: "DSP runtime"
    })]
  }
})
