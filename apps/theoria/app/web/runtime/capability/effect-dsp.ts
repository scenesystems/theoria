import { Effect, Option } from "effect"

import { isDspRunFrame } from "../../../contracts/capability/effect-dsp-runtime.js"
import { EffectDspManifest, encodeStreamManifest } from "../../../contracts/evidence/manifest.js"
import { snapshotEffectDspProjectionScript } from "../../atoms/dsp-run-plan.js"
import { dspModuleTypeAtom, dspOptimizationBudgetAtom, dspScenarioIdAtom } from "../../atoms/dsp-widget.js"
import { EffectDspProjection } from "../../atoms/run/dsp-projection.js"
import { EntryClient } from "../../services/EntryClient.js"
import { RunOwnership } from "../../state/run/types.js"
import { SurfaceRuntime, type SurfaceRuntimeSnapshot } from "../kernel/kind.js"
import { noProjectionPlayback } from "../kernel/projection-driver.js"

const effectDspId = "effect-dsp"

const effectDspPreload = Option.some(
  Effect.gen(function*() {
    const client = yield* EntryClient
    return yield* client.preload(effectDspId)
  })
)

const effectDspManifestFromSnapshot = (snapshot: SurfaceRuntimeSnapshot): EffectDspManifest | null => {
  const draft = snapshot.draft

  return draft !== null && draft.entryId === effectDspId
    ? EffectDspManifest.make(draft.input)
    : null
}

const effectDspStreamUrl = (
  snapshot: SurfaceRuntimeSnapshot,
  runToken: string | null
): string => {
  const params = new URLSearchParams()

  if (runToken !== null && runToken.trim().length > 0) {
    params.set("runToken", runToken.trim())
  }

  const manifest = effectDspManifestFromSnapshot(snapshot)

  if (manifest !== null) {
    params.set("manifest", encodeStreamManifest(manifest))
  }

  const query = params.toString()

  return query.length === 0 ? `/api/entries/${effectDspId}/stream` : `/api/entries/${effectDspId}/stream?${query}`
}

export const effectDspSurfaceRuntime = SurfaceRuntime.streaming({
  preload: effectDspPreload,
  projectionDriver: {
    ownership: RunOwnership.sharedStreaming(),
    snapshot: (registry) => {
      const plan = snapshotEffectDspProjectionScript({
        scenarioId: registry.get(dspScenarioIdAtom),
        moduleType: registry.get(dspModuleTypeAtom),
        optimizationBudget: registry.get(dspOptimizationBudgetAtom)
      })

      return {
        manifest: EffectDspManifest.make({
          scenarioId: plan.scenarioId,
          moduleType: plan.moduleType,
          optimizationBudget: plan.optimizationBudget
        }),
        localProjectionScript: plan
      }
    },
    stream: (_registry, signal, _snapshot, stepQueue, _serverCompleted) =>
      EffectDspProjection.make({ signal, stepQueue }).stream(),
    reset: (_registry) => Effect.void,
    setPlayback: noProjectionPlayback,
    syncFrameToControls: (_registry, localRunFrame) =>
      isDspRunFrame(localRunFrame)
        ? Effect.void
        : Effect.void
  },
  snapshot: (registry) => {
    const plan = snapshotEffectDspProjectionScript({
      scenarioId: registry.get(dspScenarioIdAtom),
      moduleType: registry.get(dspModuleTypeAtom),
      optimizationBudget: registry.get(dspOptimizationBudgetAtom)
    })

    return {
      draft: {
        entryId: effectDspId,
        seedId: "default",
        input: {
          scenarioId: plan.scenarioId,
          moduleType: plan.moduleType,
          optimizationBudget: plan.optimizationBudget
        },
        controls: {}
      },
      localProjectionScript: plan
    }
  },
  streamUrl: effectDspStreamUrl
})
