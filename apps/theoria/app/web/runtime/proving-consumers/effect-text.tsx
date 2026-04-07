import { Effect, Option, Stream } from "effect"

import { isEffectTextRunPlan, snapshotEffectTextRunPlan } from "../../../contracts/demo/text.js"
import { isDemoSurfaceRunPlan } from "../../../contracts/run-plan.js"
import { encodeStreamManifest } from "../../../contracts/stream-manifest.js"
import { EffectTextManifest } from "../../../contracts/stream-manifest.js"
import {
  makeAnimationStream,
  resetAnimationState,
  setAnimationPlayback,
  syncAnimationFrameToControls
} from "../../atoms/animation.js"
import { animatingAtom } from "../../atoms/animation.js"
import {
  customTextAtom,
  isEffectTextRunFrame,
  reflowControlsAtom,
  reflowStageViewportWidthAtom
} from "../../atoms/reflow.js"
import { DemoClient } from "../../services/DemoClient.js"
import { LiveReflow } from "../../view/deep/LiveReflow.js"
import {
  makeProvingConsumerLaneDescriptor,
  makeStreamingSurfaceRuntime,
  type ProvingConsumerLaneDescriptor,
  sharedStreamingOwnership,
  type SurfaceRuntimeSnapshot,
  telemetryRow,
  telemetrySection
} from "../proving-consumer-shared.js"

const effectTextId = "effect-text"

const effectTextPreload = Option.some(
  Effect.gen(function*() {
    const client = yield* DemoClient
    return yield* client.preload(effectTextId)
  })
)

const effectTextManifestFromSnapshot = (snapshot: SurfaceRuntimeSnapshot): EffectTextManifest | null => {
  const runPlan = snapshot.runPlan

  return runPlan !== null
      && isDemoSurfaceRunPlan(runPlan)
      && runPlan.id === effectTextId
      && runPlan.manifest !== null
      && runPlan.manifest._tag === effectTextId
    ? runPlan.manifest
    : null
}

const effectTextStreamUrl = (
  snapshot: SurfaceRuntimeSnapshot,
  runToken: string | null
): string => {
  const params = new URLSearchParams()

  if (runToken !== null && runToken.trim().length > 0) {
    params.set("runToken", runToken.trim())
  }

  const manifest = effectTextManifestFromSnapshot(snapshot)

  if (manifest !== null) {
    params.set("manifest", encodeStreamManifest(manifest))
  }

  const query = params.toString()

  return query.length === 0 ? `/api/demos/${effectTextId}/stream` : `/api/demos/${effectTextId}/stream?${query}`
}

const effectTextProvingConsumerLaneDescriptor: ProvingConsumerLaneDescriptor = makeProvingConsumerLaneDescriptor(
  {
    consumerId: effectTextId,
    diagnosticsKey: "effect-text/local-driver",
    interactiveWidgetKey: "effect-text/live-reflow",
    projectionDriverKey: "effect-text/animation",
    runtime: makeStreamingSurfaceRuntime({
      preload: effectTextPreload,
      projectionDriver: {
        ownership: sharedStreamingOwnership,
        snapshot: (registry) => {
          const customText = registry.get(customTextAtom)
          const viewportWidthPx = registry.get(reflowStageViewportWidthAtom)

          return {
            manifest: new EffectTextManifest({ customText, viewportWidthPx }),
            localRunPlan: snapshotEffectTextRunPlan({ customText, viewportWidthPx })
          }
        },
        makeStream: (registry, signal, snapshot, stepQueue, serverCompleted) =>
          isEffectTextRunPlan(snapshot.localRunPlan)
            ? makeAnimationStream(registry, signal, snapshot.localRunPlan, stepQueue, serverCompleted)
            : Stream.empty,
        reset: resetAnimationState,
        setPlayback: setAnimationPlayback,
        syncFrameToControls: (registry, localRunFrame) =>
          isEffectTextRunFrame(localRunFrame)
            ? syncAnimationFrameToControls(registry, localRunFrame)
            : Effect.void
      },
      snapshot: (registry) => {
        const customText = registry.get(customTextAtom)
        const viewportWidthPx = registry.get(reflowStageViewportWidthAtom)

        return {
          runPlan: {
            id: effectTextId,
            manifest: new EffectTextManifest({ customText, viewportWidthPx })
          },
          localRunPlan: snapshotEffectTextRunPlan({ customText, viewportWidthPx })
        }
      },
      streamUrl: effectTextStreamUrl
    }),
    surface: {
      interactiveWidget: <LiveReflow />,
      projectionPlaneHint: {
        stage:
          "Generic text and deep-dive reflow both reuse prepared handles — drag width, toggle obstacle bands, or press Run to stream authored width checkpoints across the same prepare-once model.",
        evidence:
          "The evidence ledger tracks prepared-handle reuse, obstacle-aware projection, and optional calibration work without inventing a second browser-owned authority.",
        source:
          "Inspect the browser layer, React helper boundary, server run path, and the text consumers that share the same prepare-and-project model."
      },
      diagnosticsSections: (get) => {
        const controls = get(reflowControlsAtom)
        const customText = get(customTextAtom).trim()

        return [telemetrySection(
          "Canonical reflow frames, frozen controls, and custom text state projected from the shared stream.",
          [
            telemetryRow("Frame reactor", get(animatingAtom) ? "projecting" : "idle"),
            telemetryRow(
              "Reflow controls",
              `corpus ${controls.corpusIndex} · width ${controls.width}px · obstacles ${
                controls.obstaclesEnabled ? "on" : "off"
              }`
            ),
            telemetryRow("Custom text", customText.length === 0 ? "empty" : `${customText.length} chars`)
          ],
          "Canonical frame reactor"
        )]
      }
    }
  }
)

export const provingConsumerLaneDescriptor = effectTextProvingConsumerLaneDescriptor

export { effectTextProvingConsumerLaneDescriptor }
