import { Effect, Option, Stream } from "effect"

import {
  defaultSamplerSeed,
  isEffectSearchRunPlan,
  optimizationTrialBudgetMax,
  optimizationTrialBudgetMin,
  snapshotEffectSearchRunPlan
} from "../../../contracts/demo/objective.js"
import { encodeStreamManifest } from "../../../contracts/stream-manifest.js"
import { EffectSearchManifest } from "../../../contracts/stream-manifest.js"
import {
  isEffectSearchRunFrame,
  makeOptimizationAnimationStream,
  resetOptimizationAnimationState,
  setOptimizationAnimationPlayback,
  trialBudgetAtom
} from "../../atoms/optimization-animation.js"
import { type RunRuntimeTelemetrySection, surfaceLocalRunFrameAtom } from "../../atoms/surface.js"
import { LiveOptimization } from "../../view/deep/LiveOptimization.js"
import {
  defaultProjectionPlaneHint,
  makeProvingConsumerLaneDescriptor,
  makeStreamingSurfaceRuntime,
  noProjectionFrameSync,
  type ProvingConsumerLaneDescriptor,
  sharedStreamingOwnership,
  type SurfaceViewExtensionContext,
  telemetryRow,
  telemetrySection
} from "../proving-consumer-shared.js"
import { DemoClient } from "../../services/DemoClient.js"

const effectSearchId = "effect-search"

const effectSearchPreload = Option.some(
  Effect.gen(function*() {
    const client = yield* DemoClient
    return yield* client.preload(effectSearchId)
  })
)

const effectSearchStreamUrl = (
  snapshot: { readonly runPlan: { readonly id: "effect-search"; readonly manifest: EffectSearchManifest | null } | null },
  runToken: string | null
): string => {
  const params = new URLSearchParams()

  if (runToken !== null && runToken.trim().length > 0) {
    params.set("runToken", runToken.trim())
  }

  if (snapshot.runPlan?.manifest !== null) {
    params.set("manifest", encodeStreamManifest(snapshot.runPlan.manifest))
  }

  const query = params.toString()

  return query.length === 0 ? `/api/demos/${effectSearchId}/stream` : `/api/demos/${effectSearchId}/stream?${query}`
}

const effectSearchDiagnosticsSections = (
  get: SurfaceViewExtensionContext
): ReadonlyArray<RunRuntimeTelemetrySection> => {
  const localRunFrame = get(surfaceLocalRunFrameAtom(effectSearchId))

  if (!isEffectSearchRunFrame(localRunFrame)) {
    return []
  }

  const { projection, telemetry } = localRunFrame
  const traceRows = [
    ...telemetry.tpe.recentSignals.map((signal) => telemetryRow(`TPE · ${signal.label}`, signal.value)),
    ...telemetry.random.recentSignals.map((signal) => telemetryRow(`Random · ${signal.label}`, signal.value))
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

export const effectSearchProvingConsumerLaneDescriptor: ProvingConsumerLaneDescriptor =
  makeProvingConsumerLaneDescriptor({
    consumerId: effectSearchId,
    diagnosticsKey: "effect-search/study-runtime",
    interactiveWidgetKey: "effect-search/live-optimization",
    projectionDriverKey: "effect-search/optimization-animation",
    runtime: makeStreamingSurfaceRuntime({
      preload: effectSearchPreload,
      projectionDriver: {
        ownership: sharedStreamingOwnership,
        snapshot: (registry) => {
        const trialBudget = registry.get(trialBudgetAtom)
        const manifestTrialBudget = Math.max(
          optimizationTrialBudgetMin,
          Math.min(trialBudget, optimizationTrialBudgetMax)
        )

        return {
          manifest: new EffectSearchManifest({ trialBudget: manifestTrialBudget }),
          localRunPlan: snapshotEffectSearchRunPlan(trialBudget)
        }
        }
      },
      makeStream: (registry, signal, snapshot, stepQueue, _serverCompleted) =>
        isEffectSearchRunPlan(snapshot.localRunPlan)
          ? makeOptimizationAnimationStream(registry, signal, snapshot.localRunPlan, stepQueue)
          : Stream.empty,
      reset: resetOptimizationAnimationState,
      setPlayback: setOptimizationAnimationPlayback,
      syncFrameToControls: noProjectionFrameSync
      },
      snapshot: (registry) => {
        const trialBudget = registry.get(trialBudgetAtom)
        const manifestTrialBudget = Math.max(
          optimizationTrialBudgetMin,
          Math.min(trialBudget, optimizationTrialBudgetMax)
        )

        return {
          runPlan: {
            id: effectSearchId,
            manifest: new EffectSearchManifest({ trialBudget: manifestTrialBudget })
          },
          localRunPlan: snapshotEffectSearchRunPlan(trialBudget)
        }
      },
      streamUrl: effectSearchStreamUrl
    }),
    surface: {
      interactiveWidget: <LiveOptimization />,
      projectionPlaneHint: {
        stage:
          "Set a trial budget, press Run, and watch authored TPE and Random checkpoints arrive on one shared study stream while the browser only projects the current frame.",
        evidence:
          "Full optimization results comparing TPE vs Random search — every trial coordinate and convergence curve is reproducible from a fixed seed.",
        source: defaultProjectionPlaneHint.source
      },
      diagnosticsSections: effectSearchDiagnosticsSections
    }
  })
