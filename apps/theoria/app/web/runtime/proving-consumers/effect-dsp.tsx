import { Effect, Option } from "effect"

import { isDspRunFrame } from "../../../contracts/demo/dsp-runtime.js"
import { encodeStreamManifest } from "../../../contracts/stream-manifest.js"
import { EffectDspManifest } from "../../../contracts/stream-manifest.js"
import { makeDspRunStream } from "../../atoms/dsp-local-driver.js"
import { snapshotEffectDspRunPlan } from "../../atoms/dsp-run-plan.js"
import { dspWidgetViewModelAtom } from "../../atoms/dsp-widget-model.js"
import { dspModuleTypeAtom, dspOptimizationBudgetAtom, dspScenarioIdAtom } from "../../atoms/dsp-widget.js"
import { DemoClient } from "../../services/DemoClient.js"
import { LiveDspEvaluation } from "../../view/deep/LiveDspEvaluation.js"
import {
  defaultProjectionPlaneHint,
  makeProvingConsumerLaneDescriptor,
  makeStreamingSurfaceRuntime,
  noProjectionPlayback,
  type ProvingConsumerLaneDescriptor,
  sharedStreamingOwnership,
  telemetryRow,
  telemetrySection
} from "../proving-consumer-shared.js"

const effectDspId = "effect-dsp"

const effectDspPreload = Option.some(
  Effect.gen(function*() {
    const client = yield* DemoClient
    return yield* client.preload(effectDspId)
  })
)

const effectDspStreamUrl = (
  snapshot: { readonly runPlan: { readonly id: "effect-dsp"; readonly manifest: EffectDspManifest | null } | null },
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

  return query.length === 0 ? `/api/demos/${effectDspId}/stream` : `/api/demos/${effectDspId}/stream?${query}`
}

export const effectDspProvingConsumerLaneDescriptor: ProvingConsumerLaneDescriptor = makeProvingConsumerLaneDescriptor({
  consumerId: effectDspId,
  diagnosticsKey: "effect-dsp/runtime",
  interactiveWidgetKey: "effect-dsp/live-evaluation",
  projectionDriverKey: "effect-dsp/local-driver",
  runtime: makeStreamingSurfaceRuntime({
    preload: effectDspPreload,
    projectionDriver: {
      ownership: sharedStreamingOwnership,
      snapshot: (registry) => {
        const plan = snapshotEffectDspRunPlan({
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
          localRunPlan: plan
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
      const plan = snapshotEffectDspRunPlan({
        scenarioId: registry.get(dspScenarioIdAtom),
        moduleType: registry.get(dspModuleTypeAtom),
        optimizationBudget: registry.get(dspOptimizationBudgetAtom)
      })

      return {
        runPlan: {
          id: effectDspId,
          manifest: new EffectDspManifest({
            scenarioId: plan.scenarioId,
            moduleType: plan.moduleType,
            optimizationBudget: plan.optimizationBudget
          })
        },
        localRunPlan: plan
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
