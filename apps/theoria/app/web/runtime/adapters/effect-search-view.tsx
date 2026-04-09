import type { RunRuntimeTelemetrySection } from "../../../contracts/presentation/run-runtime-telemetry.js"
import {
  runRuntimeTelemetryRow,
  runRuntimeTelemetrySection
} from "../../../contracts/presentation/run-runtime-telemetry.js"
import {
  defaultProjectionPlaneHint,
  ProjectionPlaneHint
} from "../../../contracts/presentation/surface-runtime-hints.js"
import { isEffectSearchRunFrame } from "../../atoms/run/optimization-animation.js"
import { surfaceLocalRunFrameAtom } from "../../atoms/surface/state.js"
import { LiveOptimization } from "../../view/deep/LiveOptimization.js"
import { SurfaceViewExtension, type SurfaceViewExtensionContext } from "../kernel/descriptor.js"
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
      runRuntimeTelemetryRow(`TPE · ${signal.label}`, signal.value)
    ),
    ...telemetry.random.recentSignals.map((signal: { readonly label: string; readonly value: string }) =>
      runRuntimeTelemetryRow(`Random · ${signal.label}`, signal.value)
    )
  ]

  return [
    runRuntimeTelemetrySection({
      description:
        "Package-authored study progress derived from canonical StudyEvent telemetry for the frozen run plan.",
      rows: [
        runRuntimeTelemetryRow(
          "Frozen plan",
          `${telemetry.trialBudget} trials per sampler · seed ${defaultSamplerSeed}`
        ),
        runRuntimeTelemetryRow("Optimizer phase", projection.phase),
        runRuntimeTelemetryRow(
          "TPE study",
          `${telemetry.tpe.completedTrials}/${telemetry.trialBudget} completed · ${telemetry.tpe.eventCount} events · best ${telemetry.tpe.bestValue}`
        ),
        runRuntimeTelemetryRow("TPE last signal", telemetry.tpe.lastSignal),
        runRuntimeTelemetryRow(
          "Random study",
          `${telemetry.random.completedTrials}/${telemetry.trialBudget} completed · ${telemetry.random.eventCount} events · best ${telemetry.random.bestValue}`
        ),
        runRuntimeTelemetryRow("Random last signal", telemetry.random.lastSignal)
      ],
      title: "Study runtime"
    }),
    ...(traceRows.length === 0
      ? []
      : [runRuntimeTelemetrySection({
        description:
          "Recent package StudyEvent signals authored by the server and projected through the canonical frame reactor.",
        kind: "trace",
        rows: traceRows,
        title: "Study event trace"
      })])
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
