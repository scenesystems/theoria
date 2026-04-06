import { Effect, Option, Stream } from "effect"

import { isEffectMathRunPlan, snapshotEffectMathRunPlan } from "../../../contracts/demo/power.js"
import { encodeStreamManifest } from "../../../contracts/stream-manifest.js"
import { EffectMathManifest } from "../../../contracts/stream-manifest.js"
import {
  isEffectMathRunFrame,
  makePowerAnimationStream,
  powerAnimatingAtom,
  powerControlsAtom,
  powerProjectionAtom,
  resetPowerAnimationStateEffect,
  setPowerAnimationPlayback,
  syncPowerFrameToControls
} from "../../atoms/power-animation.js"
import { DemoClient } from "../../services/DemoClient.js"
import { LivePowerExplorer } from "../../view/deep/LivePowerExplorer.js"
import {
  defaultProjectionPlaneHint,
  makeProvingConsumerLaneDescriptor,
  makeStreamingSurfaceRuntime,
  type ProvingConsumerLaneDescriptor,
  sharedStreamingOwnership,
  telemetryRow,
  telemetrySection
} from "../proving-consumer-shared.js"

const effectMathId = "effect-math"

const effectMathPreload = Option.some(
  Effect.gen(function*() {
    const client = yield* DemoClient
    return yield* client.preload(effectMathId)
  })
)

const effectMathStreamUrl = (
  snapshot: { readonly runPlan: { readonly id: "effect-math"; readonly manifest: EffectMathManifest | null } | null },
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

  return query.length === 0 ? `/api/demos/${effectMathId}/stream` : `/api/demos/${effectMathId}/stream?${query}`
}

export const effectMathProvingConsumerLaneDescriptor: ProvingConsumerLaneDescriptor = makeProvingConsumerLaneDescriptor(
  {
    consumerId: effectMathId,
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
            localRunPlan: snapshotEffectMathRunPlan(controls)
          }
        },
        makeStream: (registry, signal, snapshot, stepQueue, _serverCompleted) =>
          isEffectMathRunPlan(snapshot.localRunPlan)
            ? makePowerAnimationStream(registry, signal, snapshot.localRunPlan, stepQueue)
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
          runPlan: {
            id: effectMathId,
            manifest: new EffectMathManifest({ alpha: controls.alpha, d: controls.d, n: controls.n })
          },
          localRunPlan: snapshotEffectMathRunPlan(controls)
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
