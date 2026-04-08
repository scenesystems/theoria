import { Effect, Option, Stream } from "effect"

import {
  isEffectMathProjectionScript,
  snapshotEffectMathProjectionScript
} from "../../../contracts/capability/effect-math.js"
import { EffectMathManifest, encodeStreamManifest } from "../../../contracts/evidence/manifest.js"
import {
  isEffectMathRunFrame,
  makePowerAnimationStream,
  powerAnimatingAtom,
  powerControlsAtom,
  powerProjectionAtom,
  resetPowerAnimationStateEffect,
  setPowerAnimationPlayback,
  syncPowerFrameToControls
} from "../../atoms/run/power-animation.js"
import { EntryClient } from "../../services/EntryClient.js"
import { LivePowerExplorer } from "../../view/deep/LivePowerExplorer.js"
import {
  defaultProjectionPlaneHint,
  makeEntryRuntimeAdapterDescriptor,
  telemetryRow,
  telemetrySection
} from "../kernel/descriptor.js"
import { makeStreamingSurfaceRuntime, type SurfaceRuntimeSnapshot } from "../kernel/kind.js"
import { sharedStreamingOwnership } from "../kernel/projection-driver.js"

const effectMathId = "effect-math"

const effectMathPreload = Option.some(
  Effect.gen(function*() {
    const client = yield* EntryClient
    return yield* client.preload(effectMathId)
  })
)

const effectMathManifestFromSnapshot = (snapshot: SurfaceRuntimeSnapshot): EffectMathManifest | null => {
  const draft = snapshot.draft

  return draft !== null && draft.entryId === effectMathId
    ? new EffectMathManifest(draft.input)
    : null
}

const effectMathStreamUrl = (
  snapshot: SurfaceRuntimeSnapshot,
  runToken: string | null
): string => {
  const params = new URLSearchParams()

  if (runToken !== null && runToken.trim().length > 0) {
    params.set("runToken", runToken.trim())
  }

  const manifest = effectMathManifestFromSnapshot(snapshot)

  if (manifest !== null) {
    params.set("manifest", encodeStreamManifest(manifest))
  }

  const query = params.toString()

  return query.length === 0 ? `/api/entries/${effectMathId}/stream` : `/api/entries/${effectMathId}/stream?${query}`
}

export const entryRuntimeAdapterDescriptor = makeEntryRuntimeAdapterDescriptor(
  {
    entryId: effectMathId,
    diagnosticsKey: "effect-math/power-runtime",
    interactiveWidgetKey: "effect-math/live-power-explorer",
    projectionDriverKey: "effect-math/power-animation",
    runtime: makeStreamingSurfaceRuntime({
      preload: effectMathPreload,
      projectionDriver: {
        ownership: sharedStreamingOwnership,
        snapshot: (registry) => {
          const controls = registry.get(powerControlsAtom)

          return {
            manifest: new EffectMathManifest({ alpha: controls.alpha, d: controls.d, n: controls.n }),
            localProjectionScript: snapshotEffectMathProjectionScript(controls)
          }
        },
        makeStream: (registry, signal, snapshot, stepQueue, _serverCompleted) =>
          isEffectMathProjectionScript(snapshot.localProjectionScript)
            ? makePowerAnimationStream(registry, signal, snapshot.localProjectionScript, stepQueue)
            : Stream.empty,
        reset: resetPowerAnimationStateEffect,
        setPlayback: setPowerAnimationPlayback,
        syncFrameToControls: (registry, localRunFrame) =>
          isEffectMathRunFrame(localRunFrame)
            ? syncPowerFrameToControls(registry, localRunFrame)
            : Effect.void
      },
      snapshot: (registry) => {
        const controls = registry.get(powerControlsAtom)

        return {
          draft: {
            entryId: effectMathId,
            seedId: "default",
            input: { alpha: controls.alpha, d: controls.d, n: controls.n },
            controls: {}
          },
          localProjectionScript: snapshotEffectMathProjectionScript(controls)
        }
      },
      streamUrl: effectMathStreamUrl
    }),
    surface: {
      interactiveWidget: <LivePowerExplorer />,
      projectionPlaneHint: {
        stage:
          "Sweep effect sizes and sample sizes by streaming authored power checkpoints from effect-math's statistical kernels into one shared runtime spine.",
        evidence:
          "Live power-analysis reports, confidence intervals, and solver statuses streamed from effect-math Statistics and Optimization surfaces with no app-local inference formulas.",
        source: defaultProjectionPlaneHint.source
      },
      diagnosticsSections: (get) => {
        const projection = get(powerProjectionAtom)

        return [telemetrySection(
          "Canonical power frames and the frozen statistical controls projected from the shared stream.",
          [
            telemetryRow("Frame reactor", get(powerAnimatingAtom) ? "projecting" : "idle"),
            telemetryRow(
              "Power controls",
              `d ${projection.d.toFixed(2)} · n ${projection.n} · alpha ${projection.alpha.toFixed(2)}`
            ),
            telemetryRow(
              "Power report",
              `${(projection.powerReport.power * 100).toFixed(1)}% · critical t ${
                projection.powerReport.criticalValue.toFixed(2)
              }`
            ),
            telemetryRow(
              "Sample-size inversion",
              `${projection.sampleSizeReport.solver.method} · ${projection.sampleSizeReport.solver.status} · N ${projection.sampleSizeReport.sampleSize}`
            )
          ],
          "Power runtime"
        )]
      }
    }
  }
)
