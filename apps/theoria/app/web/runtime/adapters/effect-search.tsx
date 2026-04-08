import { Effect, Option, Stream } from "effect"

import {
  defaultSamplerSeed,
  isEffectSearchProjectionScript,
  optimizationTrialBudgetMax,
  optimizationTrialBudgetMin,
  snapshotEffectSearchProjectionScript
} from "../../../contracts/capability/effect-search.js"
import { EffectSearchManifest, encodeStreamManifest } from "../../../contracts/evidence/manifest.js"
import {
  isEffectSearchRunFrame,
  makeOptimizationAnimationStream,
  resetOptimizationAnimationState,
  setOptimizationAnimationPlayback,
  trialBudgetAtom
} from "../../atoms/run/optimization-animation.js"
import { type RunRuntimeTelemetrySection, surfaceLocalRunFrameAtom } from "../../atoms/surface/state.js"
import { EntryClient } from "../../services/EntryClient.js"
import { LiveOptimization } from "../../view/deep/LiveOptimization.js"
import {
  defaultProjectionPlaneHint,
  makeEntryRuntimeAdapterDescriptor,
  type SurfaceViewExtensionContext,
  telemetryRow,
  telemetrySection
} from "../kernel/descriptor.js"
import { makeStreamingSurfaceRuntime, type SurfaceRuntimeSnapshot } from "../kernel/kind.js"
import { noProjectionFrameSync, sharedStreamingOwnership } from "../kernel/projection-driver.js"

const effectSearchId = "effect-search"

const effectSearchPreload = Option.some(
  Effect.gen(function*() {
    const client = yield* EntryClient
    return yield* client.preload(effectSearchId)
  })
)

const effectSearchManifestFromSnapshot = (snapshot: SurfaceRuntimeSnapshot): EffectSearchManifest | null => {
  const draft = snapshot.draft

  return draft !== null && draft.entryId === effectSearchId
    ? new EffectSearchManifest({ trialBudget: draft.input.trialBudget })
    : null
}

const effectSearchStreamUrl = (
  snapshot: SurfaceRuntimeSnapshot,
  runToken: string | null
): string => {
  const params = new URLSearchParams()

  if (runToken !== null && runToken.trim().length > 0) {
    params.set("runToken", runToken.trim())
  }

  const manifest = effectSearchManifestFromSnapshot(snapshot)

  if (manifest !== null) {
    params.set("manifest", encodeStreamManifest(manifest))
  }

  const query = params.toString()

  return query.length === 0 ? `/api/entries/${effectSearchId}/stream` : `/api/entries/${effectSearchId}/stream?${query}`
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

export const entryRuntimeAdapterDescriptor = makeEntryRuntimeAdapterDescriptor({
  entryId: effectSearchId,
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
          localProjectionScript: snapshotEffectSearchProjectionScript(trialBudget)
        }
      },
      makeStream: (registry, signal, snapshot, stepQueue, _serverCompleted) =>
        isEffectSearchProjectionScript(snapshot.localProjectionScript)
          ? makeOptimizationAnimationStream(registry, signal, snapshot.localProjectionScript, stepQueue)
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
        draft: {
          entryId: effectSearchId,
          seedId: "default",
          input: { trialBudget: manifestTrialBudget },
          controls: {}
        },
        localProjectionScript: snapshotEffectSearchProjectionScript(trialBudget)
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
