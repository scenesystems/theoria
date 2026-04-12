import {
  runRuntimeTelemetryRow,
  runRuntimeTelemetrySection
} from "../../../contracts/presentation/run-runtime-telemetry.js"
import { dspWidgetViewModelAtom } from "../../atoms/dsp-widget-model.js"
import { LiveDspEvaluation } from "../../view/deep/LiveDspEvaluation.js"
import { SurfaceViewExtension } from "../kernel/surface-view-extension.js"

export const effectDspSurfaceViewExtension = SurfaceViewExtension.make({
  interactiveWidget: <LiveDspEvaluation />,
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
