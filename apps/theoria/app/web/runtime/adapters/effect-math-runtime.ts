import { Effect, Option, Stream } from "effect"

import { EffectMathProjectionScript, isEffectMathProjectionScript } from "../../../contracts/capability/effect-math.js"
import { EffectMathManifest, encodeStreamManifest } from "../../../contracts/evidence/manifest.js"
import { EffectMathAnimation, isEffectMathRunFrame, powerControlsAtom } from "../../atoms/run/power-animation.js"
import { EntryClient } from "../../services/EntryClient.js"
import { RunOwnership } from "../../state/run/types.js"
import { SurfaceRuntime, type SurfaceRuntimeSnapshot } from "../kernel/kind.js"

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
    ? EffectMathManifest.fromEntryDraft(draft)
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

export const effectMathSurfaceRuntime = SurfaceRuntime.streaming({
  preload: effectMathPreload,
  projectionDriver: {
    ownership: RunOwnership.sharedStreaming(),
    snapshot: (registry) => {
      const controls = registry.get(powerControlsAtom)

      return {
        manifest: EffectMathManifest.fromRunRequest(controls),
        localProjectionScript: EffectMathProjectionScript.fromControls(controls)
      }
    },
    stream: (registry, signal, snapshot, stepQueue, _serverCompleted) =>
      isEffectMathProjectionScript(snapshot.localProjectionScript)
        ? EffectMathAnimation.make({
          registry,
          signal,
          plan: snapshot.localProjectionScript,
          stepQueue
        }).stream()
        : Stream.empty,
    reset: EffectMathAnimation.reset,
    setPlayback: EffectMathAnimation.setPlayback,
    syncFrameToControls: (registry, localRunFrame) =>
      isEffectMathRunFrame(localRunFrame)
        ? EffectMathAnimation.syncFrameToControls(registry, localRunFrame)
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
      localProjectionScript: EffectMathProjectionScript.fromControls(controls)
    }
  },
  streamUrl: effectMathStreamUrl
})
