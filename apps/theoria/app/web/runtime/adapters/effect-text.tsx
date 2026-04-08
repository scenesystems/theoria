import { Effect, Option, Stream } from "effect"

import {
  isEffectTextTraversalScript,
  snapshotEffectTextTraversalScript
} from "../../../contracts/capability/effect-text.js"
import { EffectTextManifest, encodeStreamManifest } from "../../../contracts/evidence/manifest.js"
import {
  customTextAtom,
  isEffectTextRunFrame,
  reflowControlsAtom,
  reflowStageViewportWidthAtom
} from "../../atoms/reflow.js"
import {
  makeAnimationStream,
  resetAnimationState,
  setAnimationPlayback,
  syncAnimationFrameToControls
} from "../../atoms/run/animation.js"
import { animatingAtom } from "../../atoms/run/animation.js"
import { EntryClient } from "../../services/EntryClient.js"
import { LiveReflow } from "../../view/deep/LiveReflow.js"
import { makeEntryRuntimeAdapterDescriptor, telemetryRow, telemetrySection } from "../kernel/descriptor.js"
import { makeStreamingSurfaceRuntime, type SurfaceRuntimeSnapshot } from "../kernel/kind.js"
import { sharedStreamingOwnership } from "../kernel/projection-driver.js"

const effectTextId = "effect-text"

const effectTextPreload = Option.some(
  Effect.gen(function*() {
    const client = yield* EntryClient
    return yield* client.preload(effectTextId)
  })
)

const effectTextManifestFromSnapshot = (snapshot: SurfaceRuntimeSnapshot): EffectTextManifest | null => {
  const draft = snapshot.draft

  return draft !== null && draft.entryId === effectTextId
    ? new EffectTextManifest(draft.input)
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

  return query.length === 0 ? `/api/entries/${effectTextId}/stream` : `/api/entries/${effectTextId}/stream?${query}`
}

export const entryRuntimeAdapterDescriptor = makeEntryRuntimeAdapterDescriptor(
  {
    entryId: effectTextId,
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
            localProjectionScript: snapshotEffectTextTraversalScript({ customText, viewportWidthPx })
          }
        },
        makeStream: (registry, signal, snapshot, stepQueue, serverCompleted) =>
          isEffectTextTraversalScript(snapshot.localProjectionScript)
            ? makeAnimationStream(registry, signal, snapshot.localProjectionScript, stepQueue, serverCompleted)
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
          draft: {
            entryId: effectTextId,
            seedId: "default",
            input: { customText, viewportWidthPx },
            controls: {}
          },
          localProjectionScript: snapshotEffectTextTraversalScript({ customText, viewportWidthPx })
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
