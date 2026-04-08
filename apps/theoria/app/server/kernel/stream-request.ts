import { Schema } from "effect"

import { fingerprintOf } from "../../contracts/entry/fingerprint.js"
import { type RunnableEntryId, RunnableEntryId as RunnableEntryIdSchema } from "../../contracts/entry/id.js"
import { type EntryDraft, EntryDraft as EntryDraftSchema } from "../../contracts/entry/registry.js"
import {
  EffectDspManifest,
  EffectMathManifest,
  EffectSearchManifest,
  EffectTextManifest,
  type StreamManifest,
  StreamManifest as StreamManifestSchema
} from "../../contracts/evidence/manifest.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

const EntryStreamPlan = Schema.Struct({
  id: RunnableEntryIdSchema,
  manifest: Schema.NullOr(StreamManifestSchema)
})

export const EntryStreamRequest = Schema.Struct({
  runToken: NonEmptyString,
  draft: Schema.NullOr(EntryDraftSchema),
  plan: Schema.NullOr(EntryStreamPlan)
})

export type EntryStreamRequest = typeof EntryStreamRequest.Type

const encodeEntryStreamRequest = Schema.encodeSync(EntryStreamRequest)

export const EntryStreamRequestJson = Schema.parseJson(EntryStreamRequest)
export const encodeEntryStreamRequestJson = Schema.encodeSync(EntryStreamRequestJson)

type EffectTextEntryDraft = Extract<EntryDraft, { readonly entryId: "effect-text" }>
type EffectDspEntryDraft = Extract<EntryDraft, { readonly entryId: "effect-dsp" }>
type EffectSearchEntryDraft = Extract<EntryDraft, { readonly entryId: "effect-search" }>
type EffectMathEntryDraft = Extract<EntryDraft, { readonly entryId: "effect-math" }>

const isEffectTextDraft = (draft: EntryDraft): draft is EffectTextEntryDraft => draft.entryId === "effect-text"

const isEffectDspDraft = (draft: EntryDraft): draft is EffectDspEntryDraft => draft.entryId === "effect-dsp"

const isEffectSearchDraft = (draft: EntryDraft): draft is EffectSearchEntryDraft => draft.entryId === "effect-search"

const isEffectMathDraft = (draft: EntryDraft): draft is EffectMathEntryDraft => draft.entryId === "effect-math"

const manifestForEntryDraft = (draft: EntryDraft): StreamManifest | null => {
  if (isEffectTextDraft(draft)) {
    return new EffectTextManifest({
      customText: draft.input.customText,
      viewportWidthPx: draft.input.viewportWidthPx
    })
  }

  if (isEffectDspDraft(draft)) {
    return new EffectDspManifest({
      scenarioId: draft.input.scenarioId,
      moduleType: draft.input.moduleType,
      optimizationBudget: draft.input.optimizationBudget
    })
  }

  if (isEffectSearchDraft(draft)) {
    return new EffectSearchManifest({ trialBudget: draft.input.trialBudget })
  }

  if (isEffectMathDraft(draft)) {
    return new EffectMathManifest({
      d: draft.input.d,
      n: draft.input.n,
      alpha: draft.input.alpha
    })
  }

  return null
}

export const entryIdForRequest = (request: EntryStreamRequest): RunnableEntryId | null =>
  request.plan !== null
    ? request.plan.id
    : request.draft !== null && Schema.is(RunnableEntryIdSchema)(request.draft.entryId)
    ? request.draft.entryId
    : null

export const manifestForRequest = (request: EntryStreamRequest): StreamManifest | null =>
  request.plan !== null
    ? request.plan.manifest
    : request.draft === null
    ? null
    : manifestForEntryDraft(request.draft)

export const resolveEntryStreamRequestFingerprint = (request: EntryStreamRequest) =>
  fingerprintOf(encodeEntryStreamRequest(request))
