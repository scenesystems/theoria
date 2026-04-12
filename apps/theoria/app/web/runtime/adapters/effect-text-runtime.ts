import { Effect, Option, Stream } from "effect"

import {
  isEffectTextTraversalScript,
  snapshotEffectTextTraversalScript
} from "../../../contracts/capability/effect-text.js"
import { EffectTextManifest, encodeStreamManifest } from "../../../contracts/evidence/manifest.js"
import { customTextAtom, isEffectTextRunFrame, reflowStageViewportWidthAtom } from "../../atoms/reflow.js"
import { EffectTextAnimation } from "../../atoms/run/animation.js"
import { EntryClient } from "../../services/EntryClient.js"
import { RunOwnership } from "../../state/run/types.js"
import { SurfaceRuntime, type SurfaceRuntimeSnapshot } from "../kernel/kind.js"

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
    ? EffectTextManifest.fromEntryDraft(draft)
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

export const effectTextSurfaceRuntime = SurfaceRuntime.streaming({
  preload: effectTextPreload,
  projectionDriver: {
    ownership: RunOwnership.sharedStreaming(),
    snapshot: (registry) => {
      const customText = registry.get(customTextAtom)
      const viewportWidthPx = registry.get(reflowStageViewportWidthAtom)

      return {
        manifest: EffectTextManifest.fromRunRequest({ customText, viewportWidthPx }),
        localProjectionScript: snapshotEffectTextTraversalScript({ customText, viewportWidthPx })
      }
    },
    stream: (registry, signal, snapshot, stepQueue, _serverCompleted) =>
      isEffectTextTraversalScript(snapshot.localProjectionScript)
        ? EffectTextAnimation.make({
          registry,
          signal,
          plan: snapshot.localProjectionScript,
          stepQueue
        }).stream()
        : Stream.empty,
    reset: EffectTextAnimation.reset,
    setPlayback: EffectTextAnimation.setPlayback,
    syncFrameToControls: (registry, localRunFrame) =>
      isEffectTextRunFrame(localRunFrame)
        ? EffectTextAnimation.syncFrameToControls(registry, localRunFrame)
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
})
