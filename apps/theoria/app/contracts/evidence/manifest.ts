/**
 * Stream manifest — typed per-entry parameters for SSE stream requests.
 *
 * Each entry declares a tagged variant with its own fields. The transport
 * layer encodes the manifest as JSON in a single URL query parameter.
 * Server-side `streamElements` receives the decoded schema; client-side
 * snapshots construct the appropriate variant from widget atoms.
 *
 * @since 0.1.0
 * @module
 */
import { Schema } from "effect"

import { DspModuleType, DspRunRequest, DspScenarioId } from "../capability/effect-dsp.js"
import type { PowerControls } from "../capability/effect-math.js"
import {
  powerAlphaMax,
  powerAlphaMin,
  powerEffectSizeMax,
  powerEffectSizeMin,
  powerSampleSizeMax,
  powerSampleSizeMin
} from "../capability/effect-math.js"
import type { SearchConfig } from "../capability/effect-search.js"
import { SearchTrialBudget } from "../capability/effect-search.js"
import type { EntryDraft } from "../entry/registry.js"
import { WorkflowRunControls } from "../study/workflow/controls.js"
import { WorkflowScenarioIdSchema } from "../study/workflow/manifest.js"

type EffectTextEntryDraft = Extract<EntryDraft, { readonly entryId: "effect-text" }>
type EffectDspEntryDraft = Extract<EntryDraft, { readonly entryId: "effect-dsp" }>
type EffectSearchEntryDraft = Extract<EntryDraft, { readonly entryId: "effect-search" }>
type EffectMathEntryDraft = Extract<EntryDraft, { readonly entryId: "effect-math" }>
type WorkflowEntryDraft = Extract<EntryDraft, { readonly entryId: "workflow" }>

export class EffectTextManifest extends Schema.TaggedClass<EffectTextManifest>()("effect-text", {
  customText: Schema.String,
  viewportWidthPx: Schema.optionalWith(
    Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.int()),
    { default: () => 0 }
  )
}) {
  static fromRunRequest(runRequest: EffectTextEntryDraft["input"]): EffectTextManifest {
    return EffectTextManifest.make({
      customText: runRequest.customText,
      viewportWidthPx: runRequest.viewportWidthPx
    })
  }

  static fromEntryDraft(draft: EffectTextEntryDraft): EffectTextManifest {
    return EffectTextManifest.fromRunRequest(draft.input)
  }
}

export class EffectDspManifest extends Schema.TaggedClass<EffectDspManifest>()("effect-dsp", {
  scenarioId: DspScenarioId,
  moduleType: DspModuleType,
  optimizationBudget: Schema.Number.pipe(Schema.int(), Schema.between(1, 5))
}) {
  static fromRunRequest(runRequest: DspRunRequest): EffectDspManifest {
    return EffectDspManifest.make({
      scenarioId: runRequest.scenarioId,
      moduleType: runRequest.moduleType,
      optimizationBudget: runRequest.optimizationBudget
    })
  }

  static fromEntryDraft(draft: EffectDspEntryDraft): EffectDspManifest {
    return EffectDspManifest.fromRunRequest(DspRunRequest.fromManifest(draft.input))
  }
}

export class EffectSearchManifest extends Schema.TaggedClass<EffectSearchManifest>()("effect-search", {
  trialBudget: SearchTrialBudget
}) {
  static fromSearchConfig(config: SearchConfig): EffectSearchManifest {
    return EffectSearchManifest.make({
      trialBudget: config.trialBudget
    })
  }

  static fromEntryDraft(draft: EffectSearchEntryDraft): EffectSearchManifest {
    return EffectSearchManifest.fromSearchConfig(draft.input)
  }
}

export class EffectMathManifest extends Schema.TaggedClass<EffectMathManifest>()("effect-math", {
  d: Schema.Number.pipe(Schema.between(powerEffectSizeMin, powerEffectSizeMax)),
  n: Schema.Number.pipe(Schema.int(), Schema.between(powerSampleSizeMin, powerSampleSizeMax)),
  alpha: Schema.Number.pipe(Schema.between(powerAlphaMin, powerAlphaMax))
}) {
  static fromRunRequest(runRequest: PowerControls): EffectMathManifest {
    return EffectMathManifest.make({
      d: runRequest.d,
      n: runRequest.n,
      alpha: runRequest.alpha
    })
  }

  static fromEntryDraft(draft: EffectMathEntryDraft): EffectMathManifest {
    return EffectMathManifest.fromRunRequest(draft.input)
  }
}

export class WorkflowManifest extends Schema.TaggedClass<WorkflowManifest>()("workflow", {
  seedId: WorkflowScenarioIdSchema,
  controls: WorkflowRunControls
}) {
  static fromRunRequest(runRequest: {
    readonly seedId: WorkflowEntryDraft["seedId"]
    readonly controls: WorkflowEntryDraft["controls"]
  }): WorkflowManifest {
    return WorkflowManifest.make({
      seedId: runRequest.seedId,
      controls: runRequest.controls
    })
  }

  static fromEntryDraft(draft: WorkflowEntryDraft): WorkflowManifest {
    return WorkflowManifest.fromRunRequest({
      seedId: draft.seedId,
      controls: draft.controls
    })
  }
}

export const StreamManifest = Schema.Union(
  EffectTextManifest,
  EffectDspManifest,
  EffectSearchManifest,
  EffectMathManifest,
  WorkflowManifest
)

export type StreamManifest = typeof StreamManifest.Type

export const encodeStreamManifest = Schema.encodeSync(Schema.parseJson(StreamManifest))

export const decodeStreamManifest = Schema.decodeUnknownOption(Schema.parseJson(StreamManifest))
