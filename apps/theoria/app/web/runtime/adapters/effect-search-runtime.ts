import { Effect, Option, Stream } from "effect"

import { isEffectSearchProjectionScript, SearchConfig } from "../../../contracts/capability/effect-search.js"
import { EffectSearchManifest, encodeStreamManifest } from "../../../contracts/evidence/manifest.js"
import { EffectSearchAnimation, trialBudgetAtom } from "../../atoms/run/optimization-animation.js"
import { EntryClient } from "../../services/EntryClient.js"
import { RunOwnership } from "../../state/run/types.js"
import { SurfaceRuntime, type SurfaceRuntimeSnapshot } from "../kernel/kind.js"
import { noProjectionFrameSync } from "../kernel/projection-driver.js"

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
    ? EffectSearchManifest.fromEntryDraft(draft)
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

export const effectSearchSurfaceRuntime = SurfaceRuntime.streaming({
  preload: effectSearchPreload,
  projectionDriver: {
    ownership: RunOwnership.sharedStreaming(),
    snapshot: (registry) => {
      const config = SearchConfig.fromTrialBudget(registry.get(trialBudgetAtom))

      return {
        manifest: EffectSearchManifest.fromSearchConfig(config),
        localProjectionScript: config.projectionScript()
      }
    },
    stream: (registry, signal, snapshot, stepQueue, _serverCompleted) =>
      isEffectSearchProjectionScript(snapshot.localProjectionScript)
        ? EffectSearchAnimation.make({
          registry,
          signal,
          plan: snapshot.localProjectionScript,
          stepQueue
        }).stream()
        : Stream.empty,
    reset: EffectSearchAnimation.reset,
    setPlayback: EffectSearchAnimation.setPlayback,
    syncFrameToControls: noProjectionFrameSync
  },
  snapshot: (registry) => {
    const config = SearchConfig.fromTrialBudget(registry.get(trialBudgetAtom))

    return {
      draft: {
        entryId: effectSearchId,
        seedId: "default",
        input: config,
        controls: {}
      },
      localProjectionScript: config.projectionScript()
    }
  },
  streamUrl: effectSearchStreamUrl
})
