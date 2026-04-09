import { isEffectSearchRunFrame } from "../../atoms/run/optimization-animation.js"
import type { RunRuntimeTelemetrySection } from "../../atoms/surface/run-telemetry.js"
import { surfaceLocalRunFrameAtom } from "../../atoms/surface/state.js"
import { LiveOptimization } from "../../view/deep/LiveOptimization.js"
import {
  defaultProjectionPlaneHint,
  ProjectionPlaneHint,
  SurfaceViewExtension,
  type SurfaceViewExtensionContext,
  telemetryRow,
  telemetrySection
} from "../kernel/descriptor.js"
import { defaultSamplerSeed } from "./effect-search-runtime.js"

const effectSearchId = "effect-search"

const effectSearchDiagnosticsSections = (
  get: SurfaceViewExtensionContext
): ReadonlyArray<RunRuntimeTelemetrySection> => {
  const localRunFrame = get(surfaceLocalRunFrameAtom(effectSearchId))

  if (!isEffectSearchRunFrame(localRunFrame)) {
    return []
  }

  const { projection, telemetry } = localRunFrame
  const traceRows = [
    ...telemetry.tpe.recentSignals.map((signal: { readonly label: string; readonly value: string }) =>
      telemetryRow(`TPE · ${signal.label}`, signal.value)
    ),
    ...telemetry.random.recentSignals.map((signal: { readonly label: string; readonly value: string }) =>
      telemetryRow(`Random · ${signal.label}`, signal.value)
    )
  ]

  return [
    telemetrySection(
      "Package-authored study progress derived from canonical StudyEvent telemetry for the frozen run plan.",
      [
        telemetryRow("Frozen plan", `${telemetry.trialBudget} trials per sampler · seed ${defaultSamplerSeed}`),
        telemetryRow("Optimizer phase", projection.phase),
        telemetryRow(
          "TPE study",
          `${telemetry.tpe.completedTrials}/${telemetry.trialBudget} completed · ${telemetry.tpe.eventCount} events · best ${telemetry.tpe.bestValue}`
        ),
        telemetryRow("TPE last signal", telemetry.tpe.lastSignal),
        telemetryRow(
          "Random study",
          `${telemetry.random.completedTrials}/${telemetry.trialBudget} completed · ${telemetry.random.eventCount} events · best ${telemetry.random.bestValue}`
        ),
        telemetryRow("Random last signal", telemetry.random.lastSignal)
      ],
      "Study runtime"
    ),
    ...(traceRows.length === 0
      ? []
      : [telemetrySection(
        "Recent package StudyEvent signals authored by the server and projected through the canonical frame reactor.",
        traceRows,
        "Study event trace",
        "trace"
      )])
  ]
}

const effectSearchProjectionPlaneHint = ProjectionPlaneHint.make({
  stage:
    "Set a trial budget, press Run, and watch authored TPE and Random checkpoints arrive on one shared study stream while the browser only projects the current frame.",
  evidence:
    "Full optimization results comparing TPE vs Random search — every trial coordinate and convergence curve is reproducible from a fixed seed.",
  source: defaultProjectionPlaneHint.source
})

export const effectSearchSurfaceViewExtension = SurfaceViewExtension.make({
  interactiveWidget: <LiveOptimization />,
  projectionPlaneHint: effectSearchProjectionPlaneHint,
  diagnosticsSections: effectSearchDiagnosticsSections
})
