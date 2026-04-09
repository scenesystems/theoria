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
import { Match, Schema } from "effect"

import { DspModuleType, DspScenarioId } from "../capability/effect-dsp.js"
import {
  powerAlphaMax,
  powerAlphaMin,
  powerEffectSizeMax,
  powerEffectSizeMin,
  powerSampleSizeMax,
  powerSampleSizeMin
} from "../capability/effect-math.js"
import { optimizationTrialBudgetMax, optimizationTrialBudgetMin } from "../capability/effect-search.js"
import type { EntryDraft } from "../entry/registry.js"
import { WorkflowRunControls } from "../study/workflow/controls.js"
import { WorkflowScenarioIdSchema } from "../study/workflow/manifest.js"

export class EffectTextManifest extends Schema.TaggedClass<EffectTextManifest>()("effect-text", {
  customText: Schema.String,
  viewportWidthPx: Schema.optionalWith(
    Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.int()),
    { default: () => 0 }
  )
}) {}

export class EffectDspManifest extends Schema.TaggedClass<EffectDspManifest>()("effect-dsp", {
  scenarioId: DspScenarioId,
  moduleType: DspModuleType,
  optimizationBudget: Schema.Number.pipe(Schema.int(), Schema.between(1, 5))
}) {}

export class EffectSearchManifest extends Schema.TaggedClass<EffectSearchManifest>()("effect-search", {
  trialBudget: Schema.Number.pipe(Schema.int(), Schema.between(optimizationTrialBudgetMin, optimizationTrialBudgetMax))
}) {}

export class EffectMathManifest extends Schema.TaggedClass<EffectMathManifest>()("effect-math", {
  d: Schema.Number.pipe(Schema.between(powerEffectSizeMin, powerEffectSizeMax)),
  n: Schema.Number.pipe(Schema.int(), Schema.between(powerSampleSizeMin, powerSampleSizeMax)),
  alpha: Schema.Number.pipe(Schema.between(powerAlphaMin, powerAlphaMax))
}) {}

export class WorkflowManifest extends Schema.TaggedClass<WorkflowManifest>()("workflow", {
  seedId: WorkflowScenarioIdSchema,
  controls: WorkflowRunControls
}) {}

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

const streamManifestProjection = Match.type<EntryDraft>().pipe(
  Match.withReturnType<StreamManifest | null>(),
  Match.when(
    { entryId: "effect-text" },
    ({ input }) =>
      new EffectTextManifest({
        customText: input.customText,
        viewportWidthPx: input.viewportWidthPx
      })
  ),
  Match.when(
    { entryId: "effect-dsp" },
    ({ input }) =>
      new EffectDspManifest({
        scenarioId: input.scenarioId,
        moduleType: input.moduleType,
        optimizationBudget: input.optimizationBudget
      })
  ),
  Match.when(
    { entryId: "effect-search" },
    ({ input }) => new EffectSearchManifest({ trialBudget: input.trialBudget })
  ),
  Match.when(
    { entryId: "effect-math" },
    ({ input }) =>
      new EffectMathManifest({
        d: input.d,
        n: input.n,
        alpha: input.alpha
      })
  ),
  Match.when(
    { entryId: "workflow" },
    ({ controls, seedId }) =>
      new WorkflowManifest({
        seedId,
        controls
      })
  ),
  Match.orElse(() => null)
)

export const streamManifestFromEntryDraft = (draft: EntryDraft): StreamManifest | null =>
  streamManifestProjection(draft)
