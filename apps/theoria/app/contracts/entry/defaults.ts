import { Match } from "effect"
import * as Option from "effect/Option"

import { defaultDspModuleType, defaultDspScenarioId, defaultOptimizationBudget } from "../capability/effect-dsp.js"
import { defaultPowerControls } from "../capability/effect-math.js"
import { defaultWorkflowEntrySelection } from "../study/workflow/selection.js"
import { type EntryId, workflowEntryId } from "./id.js"
import { entryDescriptorForId, type EntryDraft } from "./registry.js"

export const defaultEffectTextEntryInput: Extract<EntryDraft, { readonly entryId: "effect-text" }>["input"] = {
  customText: "",
  viewportWidthPx: 0
}

export const defaultEffectMathEntryInput: Extract<EntryDraft, { readonly entryId: "effect-math" }>["input"] = {
  alpha: defaultPowerControls.alpha,
  d: defaultPowerControls.d,
  n: defaultPowerControls.n
}

export const defaultEffectDspEntryInput: Extract<EntryDraft, { readonly entryId: "effect-dsp" }>["input"] = {
  scenarioId: defaultDspScenarioId,
  moduleType: defaultDspModuleType,
  optimizationBudget: defaultOptimizationBudget
}

export const defaultWorkflowEntryDraft: Extract<EntryDraft, { readonly entryId: "workflow" }> = {
  entryId: workflowEntryId,
  seedId: defaultWorkflowEntrySelection.seedId,
  input: {},
  controls: defaultWorkflowEntrySelection.controls
}

export const entrySeedsFor = (entryId: EntryId) => entryDescriptorForId(entryId).seeds

export const defaultSeedIdFor = (entryId: EntryId): Option.Option<string> =>
  Option.fromNullable(entrySeedsFor(entryId)[0]?.seedId)

export const defaultEntryDraft = (id: EntryId): EntryDraft =>
  Match.value(id).pipe(
    Match.when("effect-text", (): EntryDraft => ({
      entryId: "effect-text",
      seedId: "default",
      input: defaultEffectTextEntryInput,
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
      input: defaultEffectMathEntryInput,
      controls: {}
    })),
    Match.when("effect-dsp", (): EntryDraft => ({
      entryId: "effect-dsp",
      seedId: "default",
      input: defaultEffectDspEntryInput,
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
    Match.when(workflowEntryId, (): EntryDraft => defaultWorkflowEntryDraft),
    Match.exhaustive
  )
