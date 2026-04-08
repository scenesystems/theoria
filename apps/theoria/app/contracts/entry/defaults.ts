import { Match } from "effect"
import * as Option from "effect/Option"

import { defaultDspModuleType, defaultDspScenarioId, defaultOptimizationBudget } from "../capability/effect-dsp.js"
import { defaultPowerControls } from "../capability/effect-math.js"
import { defaultWorkflowComparisonId } from "../study/workflow/comparison/manifest.js"
import { defaultWorkflowEntryControls, makeWorkflowEntryControls } from "../study/workflow/comparison/run.js"
import type { EntryId } from "./id.js"
import { entryDescriptorForId, type EntryDraft } from "./registry.js"

export const defaultWorkflowEntryDraft: Extract<EntryDraft, { readonly entryId: "workflow" }> = {
  entryId: "workflow",
  seedId: defaultWorkflowComparisonId,
  input: {},
  controls: makeWorkflowEntryControls(defaultWorkflowEntryControls)
}

export const entrySeedsFor = (entryId: EntryId) => entryDescriptorForId(entryId).seeds

export const defaultSeedIdFor = (entryId: EntryId): Option.Option<string> =>
  Option.fromNullable(entrySeedsFor(entryId)[0]?.seedId)

export const defaultEntryDraft = (id: EntryId): EntryDraft =>
  Match.value(id).pipe(
    Match.when("effect-text", (): EntryDraft => ({
      entryId: "effect-text",
      seedId: "default",
      input: {
        customText: "",
        viewportWidthPx: 0
      },
      controls: {}
    })),
    Match.when("effect-search", (): EntryDraft => ({
      entryId: "effect-search",
      seedId: "default",
      input: {
        trialBudget: 30
      },
      controls: {}
    })),
    Match.when("effect-math", (): EntryDraft => ({
      entryId: "effect-math",
      seedId: "default",
      input: {
        alpha: defaultPowerControls.alpha,
        d: defaultPowerControls.d,
        n: defaultPowerControls.n
      },
      controls: {}
    })),
    Match.when("effect-dsp", (): EntryDraft => ({
      entryId: "effect-dsp",
      seedId: "default",
      input: {
        scenarioId: defaultDspScenarioId,
        moduleType: defaultDspModuleType,
        optimizationBudget: defaultOptimizationBudget
      },
      controls: {}
    })),
    Match.when("effect-inference", (): EntryDraft => ({
      entryId: "effect-inference",
      seedId: "default",
      input: {},
      controls: {}
    })),
    Match.when("digest", (): EntryDraft => ({
      entryId: "digest",
      seedId: "default",
      input: {},
      controls: {}
    })),
    Match.when("seal", (): EntryDraft => ({
      entryId: "seal",
      seedId: "default",
      input: {},
      controls: {}
    })),
    Match.when("sign", (): EntryDraft => ({
      entryId: "sign",
      seedId: "default",
      input: {},
      controls: {}
    })),
    Match.when("workflow", (): EntryDraft => defaultWorkflowEntryDraft),
    Match.exhaustive
  )
