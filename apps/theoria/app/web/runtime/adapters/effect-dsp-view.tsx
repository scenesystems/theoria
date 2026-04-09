import { dspWidgetViewModelAtom } from "../../atoms/dsp-widget-model.js"
import { LiveDspEvaluation } from "../../view/deep/LiveDspEvaluation.js"
import {
  defaultProjectionPlaneHint,
  ProjectionPlaneHint,
  SurfaceViewExtension,
  telemetryRow,
  telemetrySection
} from "../kernel/descriptor.js"

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

    return [telemetrySection(
      "Canonical DSP frames, control lock state, and active runtime context projected from the shared stream.",
      [
        telemetryRow("Frame reactor", viewModel.isAnimating ? "projecting" : "idle"),
        telemetryRow("DSP controls", viewModel.controlsLocked ? "frozen" : "interactive"),
        telemetryRow(
          "DSP runtime",
          viewModel.runtimeStatus === null
            ? `${viewModel.scenario.label} · ${viewModel.moduleType} · ${viewModel.optimizationBudget.display}`
            : viewModel.runtimeStatus.title
        )
      ],
      "DSP runtime"
    )]
  }
})
