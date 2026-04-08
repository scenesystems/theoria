import { Effect, Option } from "effect"

import { isDspRunFrame } from "../../../contracts/capability/effect-dsp-runtime.js"
import { EffectDspManifest, encodeStreamManifest } from "../../../contracts/evidence/manifest.js"
import { makeDspRunStream } from "../../atoms/dsp-local-driver.js"
import { snapshotEffectDspProjectionScript } from "../../atoms/dsp-run-plan.js"
import { dspWidgetViewModelAtom } from "../../atoms/dsp-widget-model.js"
import { dspModuleTypeAtom, dspOptimizationBudgetAtom, dspScenarioIdAtom } from "../../atoms/dsp-widget.js"
import { EntryClient } from "../../services/EntryClient.js"
import { LiveDspEvaluation } from "../../view/deep/LiveDspEvaluation.js"
import {
  defaultProjectionPlaneHint,
  makeEntryRuntimeAdapterDescriptor,
  telemetryRow,
  telemetrySection
} from "../kernel/descriptor.js"
import { makeStreamingSurfaceRuntime, type SurfaceRuntimeSnapshot } from "../kernel/kind.js"
import { noProjectionPlayback, sharedStreamingOwnership } from "../kernel/projection-driver.js"

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
    ? new EffectDspManifest(draft.input)
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

export const entryRuntimeAdapterDescriptor = makeEntryRuntimeAdapterDescriptor({
  entryId: effectDspId,
  diagnosticsKey: "effect-dsp/runtime",
  interactiveWidgetKey: "effect-dsp/live-evaluation",
  projectionDriverKey: "effect-dsp/local-driver",
  runtime: makeStreamingSurfaceRuntime({
    preload: effectDspPreload,
    projectionDriver: {
      ownership: sharedStreamingOwnership,
      snapshot: (registry) => {
        const plan = snapshotEffectDspProjectionScript({
          scenarioId: registry.get(dspScenarioIdAtom),
          moduleType: registry.get(dspModuleTypeAtom),
          optimizationBudget: registry.get(dspOptimizationBudgetAtom)
        })

        return {
          manifest: new EffectDspManifest({
            scenarioId: plan.scenarioId,
            moduleType: plan.moduleType,
            optimizationBudget: plan.optimizationBudget
          }),
          localProjectionScript: plan
        }
      },
      makeStream: (_registry, signal, _snapshot, stepQueue, _serverCompleted) => makeDspRunStream(signal, stepQueue),
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
  }),
  surface: {
    interactiveWidget: <LiveDspEvaluation />,
    projectionPlaneHint: {
      stage:
        "Inspect typed sentiment evaluations case-by-case on the same authored step stream that freezes the contract, runs the provider-backed program, and reports the comparison.",
      evidence:
        "Provider-backed evaluation traces, correctness deltas, and runtime metadata — every run records the typed program, baseline, and outcome together.",
      source: defaultProjectionPlaneHint.source
    },
    diagnosticsSections: (get) => {
      const viewModel = get(dspWidgetViewModelAtom)

      return [telemetrySection(
        "Canonical DSP frames, control lock state, and active runtime context projected from the shared stream.",
        [
          telemetryRow("Frame reactor", viewModel.isAnimating ? "projecting" : "idle"),
          telemetryRow("DSP controls", viewModel.controlsLocked ? "frozen" : "interactive"),
          telemetryRow(
            "DSP runtime",
            viewModel.runtimeStatus === null
              ? `${viewModel.scenario.label} · ${viewModel.moduleType} · ${viewModel.optimizationBudget.display}`
              : viewModel.runtimeStatus.title
          )
        ],
        "DSP runtime"
      )]
    }
  }
})
